import axios from "axios";

const defaults = {
  region: "eu",
};

function ensureSuccess(response) {
  const data = response.data;
  if (typeof data !== "object") {
    throw new Error(data);
  }
  if (data.access_token) {
    return;
  }
  if (data.responseStatus === "error") {
    throw new Error(data.errorMsg);
  }

  // Handle specific Tuya API errors
  if (data.header && data.header.code) {
    switch (data.header.code) {
      case "SUCCESS":
        return; // Success case
      case "DependentServiceUnavailable":
        throw new Error(
          "Tuya service temporarily unavailable. Please try again in a few minutes."
        );
      case "TOKEN_EXPIRED":
        throw new Error("Authentication expired. Please log in again.");
      case "RATE_LIMIT_EXCEEDED":
        throw new Error("Too many requests. Please wait before trying again.");
      default:
        if (data.header.msg) {
          throw new Error(data.header.msg);
        } else {
          throw new Error(`API Error: ${data.header.code}`);
        }
    }
  }

  // Fallback for missing header
  if (!data.header) {
    throw new Error("Invalid response format from Tuya API");
  }
}

function HomeAssistantClient(session) {
  let client;
  if (session) {
    client = createClient(session.region);
  }

  function createClient(region) {
    return axios.create({ baseURL: "/api/homeassistant", params: { region } });
  }

  function normalizeToken(token) {
    const result = {
      ...token,
      expires: Math.trunc(Date.now() / 1000) + token.expires_in,
    };
    delete result.expires_in;
    return result;
  }

  this.login = async (userName, password, region) => {
    region = region || defaults.region;

    client = createClient(region);

    const authResponse = await client.post(
      "/auth.do",
      new URLSearchParams({
        userName,
        password,
        countryCode: "00",
        bizType: "smart_life",
        from: "tuya",
      })
    );
    console.debug("auth.do", userName, authResponse.data);
    ensureSuccess(authResponse);

    session = {
      region,
      token: normalizeToken(authResponse.data),
    };
  };

  this.refreshAuthToken = async () => {
    const accessResponse = await client.post("/access.do", {
      grant_type: "refresh_token",
      refresh_token: session.token.refresh_token,
      rand: Math.random(),
    });
    console.debug("access.do", accessResponse.data);
    ensureSuccess(accessResponse);

    session.token = normalizeToken(accessResponse.data);
  };

  this.getSession = () => session;

  this.dropSession = () => {
    session = null;
  };

  // Enhanced device discovery with additional properties
  this.deviceDiscovery = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    try {
      const discoveryResponse = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "discovery",
          name: "Discovery",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });
      console.debug("device discovery response", discoveryResponse.data);
      ensureSuccess(discoveryResponse);

      const payload = discoveryResponse.data.payload;
      if (payload && payload.devices) {
        // Enhanced device processing with additional properties
        payload.devices = payload.devices
          .map((device) => {
            // workaround json escaped signes
            device.name = JSON.parse(`"${device.name}"`);

            // workaround automation type
            if (device.dev_type === "scene" && device.name.endsWith("#")) {
              device.dev_type = "automation";
              device.name = device.name.replace(/\s*#$/, "");
            }

            // Enhanced device properties
            const enhancedDevice = {
              id: device.id,
              name: device.name,
              type: device.dev_type,
              data: device.data,
              icon: device.icon,
              // Additional properties for enhanced functionality
              properties: device.properties || {},
              capabilities: device.capabilities || [],
              // Extract dimmer/brightness information
              brightness: this.extractBrightness(device),
              // Extract color information
              color: this.extractColor(device),
              // Extract color temperature
              colorTemperature: this.extractColorTemperature(device),
              // Extract work mode
              workMode: this.extractWorkMode(device),
            };

            return enhancedDevice;
          })
          .filter((device) => device.type !== "automation");
      }

      return discoveryResponse.data;
    } catch (error) {
      // Retry logic for specific errors
      if (
        error.message.includes("temporarily unavailable") &&
        retryCount < maxRetries
      ) {
        console.log(
          `Device discovery failed, retrying in ${
            retryDelay / 1000
          }s... (attempt ${retryCount + 1}/${maxRetries})`
        );

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        // Recursive retry
        return this.deviceDiscovery(retryCount + 1);
      }

      // If max retries reached or other error, throw
      throw error;
    }
  };

  // Extract brightness/dimmer percentage from device data
  this.extractBrightness = (device) => {
    if (!device.data) return null;

    // Common brightness properties in Tuya devices
    const brightnessKeys = [
      "bright_value",
      "bright_value_1",
      "brightness",
      "dimmer",
    ];

    for (const key of brightnessKeys) {
      if (device.data[key] !== undefined) {
        // Convert to percentage (0-100)
        let value = device.data[key];
        if (value > 100) {
          // If value is in range 0-1000, convert to 0-100
          value = Math.round((value / 1000) * 100);
        }
        return {
          value: value,
          raw: device.data[key],
          key: key,
        };
      }
    }

    return null;
  };

  // Extract color information from device data
  this.extractColor = (device) => {
    if (!device.data) return null;

    // Common color properties in Tuya devices
    const colorKeys = [
      "colour_data",
      "color_data",
      "colour",
      "color",
      "hsv",
      "rgb",
    ];

    for (const key of colorKeys) {
      if (device.data[key] !== undefined) {
        return {
          value: device.data[key],
          key: key,
          // Try to parse HSV format if it's a string
          parsed: this.parseColorValue(device.data[key]),
        };
      }
    }

    return null;
  };

  // Extract color temperature from device data
  this.extractColorTemperature = (device) => {
    if (!device.data) return null;

    const tempKeys = ["temp_value", "color_temp", "colour_temp", "temperature"];

    for (const key of tempKeys) {
      if (device.data[key] !== undefined) {
        return {
          value: device.data[key],
          key: key,
        };
      }
    }

    return null;
  };

  // Extract work mode from device data
  this.extractWorkMode = (device) => {
    if (!device.data) return null;

    const modeKeys = ["work_mode", "mode", "scene_mode"];

    for (const key of modeKeys) {
      if (device.data[key] !== undefined) {
        return {
          value: device.data[key],
          key: key,
        };
      }
    }

    return null;
  };

  // Parse color value (HSV format: "hhhssssvvv")
  this.parseColorValue = (colorValue) => {
    if (typeof colorValue === "string" && colorValue.length >= 12) {
      try {
        const h = parseInt(colorValue.substring(0, 4), 16) || 0;
        const s = parseInt(colorValue.substring(4, 8), 16) || 0;
        const v = parseInt(colorValue.substring(8, 12), 16) || 0;

        return {
          hue: Math.round((h / 65535) * 360),
          saturation: Math.round((s / 65535) * 100),
          value: Math.round((v / 65535) * 100),
        };
      } catch (e) {
        console.warn("Failed to parse color value:", colorValue, e);
      }
    }
    return null;
  };

  // Get scenes from home
  this.getScenes = async () => {
    try {
      const scenesResponse = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "discovery",
          name: "Discovery",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      console.debug("scenes discovery response", scenesResponse.data);
      ensureSuccess(scenesResponse);

      const payload = scenesResponse.data.payload;
      if (payload && payload.devices) {
        // Filter and process scene and automation devices
        const scenes = payload.devices
          .filter((device) => {
            // Include scenes, automations, and scene-like devices
            const isScene = device.dev_type === "scene";
            const isAutomation = device.dev_type === "automation";
            const isSceneLike = device.name.toLowerCase().includes("scene") || 
                               device.name.toLowerCase().includes("cena") ||
                               device.name.toLowerCase().includes("automation") ||
                               device.name.toLowerCase().includes("automação");
            
            return isScene || isAutomation || isSceneLike;
          })
          .map((scene) => {
            // Clean up scene names (remove # suffix if present)
            let cleanName = scene.name;
            if (cleanName.endsWith("#")) {
              cleanName = cleanName.replace(/\s*#$/, "");
            }
            
            // Parse JSON escaped names
            try {
              cleanName = JSON.parse(`"${cleanName}"`);
            } catch (e) {
              console.warn("Failed to parse scene name:", cleanName, e);
            }

            return {
              id: scene.id,
              name: cleanName,
              type: scene.dev_type === "automation" ? "automation" : "scene",
              icon: scene.icon || "/device_icons/scene.png",
              data: scene.data,
            };
          });

        return scenes;
      }

      return [];
    } catch (err) {
      console.error("Error getting scenes:", err);
      return [];
    }
  };

  // Enhanced device control with support for brightness, color, etc.
  this.deviceControl = async (deviceId, action, fieldValue, fieldName) => {
    // for testing purpose only
    if (deviceId === 0) {
      return { header: { code: "SUCCESS" } };
    }

    fieldName = fieldName || "value";

    if (
      action === "turnOnOff" &&
      fieldName === "value" &&
      typeof fieldValue === "boolean"
    ) {
      fieldValue = fieldValue ? 1 : 0;
    }

    const controlResponse = await client.post("/skill", {
      header: {
        payloadVersion: 1,
        namespace: "control",
        name: action,
      },
      payload: {
        accessToken: session.token.access_token,
        devId: deviceId,
        [fieldName]: fieldValue,
      },
    });
    console.debug(
      "device control response",
      `${action}: ${fieldName}=${fieldValue}`,
      controlResponse.data
    );
    ensureSuccess(controlResponse);
  };

  // Set device brightness (for dimmers and lights)
  this.setBrightness = async (deviceId, brightness) => {
    // Convert percentage (0-100) to device range (usually 0-1000)
    const deviceValue = Math.round((brightness / 100) * 1000);
    return this.deviceControl(deviceId, "brightnessSet", deviceValue, "value");
  };

  // Set device color (HSV format)
  this.setColor = async (deviceId, hue, saturation, value) => {
    // Convert HSV to Tuya format
    const h = Math.round((hue / 360) * 65535)
      .toString(16)
      .padStart(4, "0");
    const s = Math.round((saturation / 100) * 65535)
      .toString(16)
      .padStart(4, "0");
    const v = Math.round((value / 100) * 65535)
      .toString(16)
      .padStart(4, "0");
    const colorValue = h + s + v;

    return this.deviceControl(deviceId, "colorSet", colorValue, "color");
  };

  // Set color temperature
  this.setColorTemperature = async (deviceId, temperature) => {
    return this.deviceControl(
      deviceId,
      "colorTemperatureSet",
      temperature,
      "value"
    );
  };

  // Trigger scene
  this.triggerScene = async (sceneId) => {
    return this.deviceControl(sceneId, "turnOnOff", true);
  };
}

export default {
  HomeAssistantClient,
};
