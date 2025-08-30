import axios from "axios";

const defaults = {
  region: "eu",
};

// Enhanced error handling with fallback strategies
function ensureSuccess(response) {
  console.log(
    `[ENSURE SUCCESS] Starting validation for response:`,
    response.data
  );

  const data = response.data;
  if (typeof data !== "object") {
    console.log(`[ENSURE SUCCESS] Data is not an object:`, typeof data, data);
    throw new Error(data);
  }

  console.log(`[ENSURE SUCCESS] Data is object, checking for access_token...`);
  if (data.access_token) {
    console.log(`[ENSURE SUCCESS] Found access_token, returning early`);
    return;
  }

  console.log(`[ENSURE SUCCESS] No access_token, checking responseStatus...`);
  if (data.responseStatus === "error") {
    console.log(`[ENSURE SUCCESS] Found responseStatus error:`, data.errorMsg);
    throw new Error(data.errorMsg);
  }

  console.log(`[ENSURE SUCCESS] Checking header and code...`);
  // Handle specific Tuya API errors with enhanced messaging
  if (data.header && data.header.code) {
    console.log(`[ENSURE SUCCESS] Header code found:`, data.header.code);
    console.log(`[ENSURE SUCCESS] Header message:`, data.header.msg);

    switch (data.header.code) {
      case "SUCCESS":
        console.log(`[ENSURE SUCCESS] SUCCESS code found, returning`);
        return; // Success case
      case "DependentServiceUnavailable":
        console.log(
          `[ENSURE SUCCESS] DependentServiceUnavailable error detected`
        );
        throw new Error("DependentServiceUnavailable");
      case "TOKEN_EXPIRED":
        console.log(`[ENSURE SUCCESS] TOKEN_EXPIRED error detected`);
        throw new Error("Authentication expired. Please log in again.");
      case "RATE_LIMIT_EXCEEDED":
        console.log(`[ENSURE SUCCESS] RATE_LIMIT_EXCEEDED error detected`);
        throw new Error("Too many requests. Please wait before trying again.");
      case "SERVICE_UNAVAILABLE":
        console.log(`[ENSURE SUCCESS] SERVICE_UNAVAILABLE error detected`);
        throw new Error(
          "Tuya service is currently unavailable. Please try again later."
        );
      case "NETWORK_ERROR":
        console.log(`[ENSURE SUCCESS] NETWORK_ERROR error detected`);
        throw new Error(
          "Network connection issue. Please check your internet connection."
        );
      default:
        console.log(`[ENSURE SUCCESS] Unknown error code:`, data.header.code);
        if (data.header.msg) {
          console.log(
            `[ENSURE SUCCESS] Throwing error with message:`,
            data.header.msg
          );
          throw new Error(data.header.msg);
        } else {
          console.log(
            `[ENSURE SUCCESS] Throwing generic error for code:`,
            data.header.code
          );
          throw new Error(`API Error: ${data.header.code}`);
        }
    }
  }

  console.log(`[ENSURE SUCCESS] No header found, checking if header exists...`);
  // Fallback for missing header
  if (!data.header) {
    console.log(`[ENSURE SUCCESS] No header found, throwing error`);
    throw new Error("Invalid response format from Tuya API");
  }

  console.log(`[ENSURE SUCCESS] Validation completed successfully`);
}

// Enhanced retry strategy with exponential backoff
// Enhanced retry strategy with Tuya-specific timing recommendations
// Enhanced retry strategy with Tuya-specific timing recommendations and fallback
async function retryWithBackoff(
  operation,
  maxRetries = 2,
  baseDelay = 5000,
  fallbackData = null
) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryableError = isRetryableErrorType(error);

      // Special handling for DependentServiceUnavailable
      if (error.message.includes("DependentServiceUnavailable")) {
        console.log(
          `[RETRY] DependentServiceUnavailable detected on attempt ${
            attempt + 1
          }`
        );

        if (fallbackData && attempt === 0) {
          console.log(`[RETRY] Using fallback data for immediate response`);
          return fallbackData;
        }

        if (isLastAttempt) {
          console.log(
            `[RETRY] Max retries reached for DependentServiceUnavailable`
          );
          if (fallbackData) {
            console.log(`[RETRY] Returning fallback data as final fallback`);
            return fallbackData;
          }
          throw new Error(
            "Tuya service is currently unavailable. Please try again later. You can use cached data if available."
          );
        }

        // For DependentServiceUnavailable, use much longer delays
        const delay = baseDelay * Math.pow(5, attempt); // 5s, 25s, 125s
        console.log(
          `[RETRY] Service unavailable. Waiting ${delay / 1000}s before retry ${
            attempt + 1
          }/${maxRetries}...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (isLastAttempt || !isRetryableError) {
        throw error;
      }

      // Tuya-specific retry strategy with longer delays
      let delay;
      if (
        error.message.includes("temporarily unavailable") ||
        error.message.includes("service is currently unavailable")
      ) {
        // For service unavailability, use longer delays
        delay = baseDelay * Math.pow(3, attempt); // 5s, 15s, 45s
        console.log(
          `[RETRY] Service unavailable detected. Waiting ${
            delay / 1000
          }s before retry ${attempt + 1}/${maxRetries}...`
        );
      } else if (
        error.message.includes("rate limit") ||
        error.message.includes("too many requests")
      ) {
        // For rate limiting, use even longer delays
        delay = baseDelay * Math.pow(4, attempt); // 5s, 20s, 80s
        console.log(
          `[RETRY] Rate limit detected. Waiting ${delay / 1000}s before retry ${
            attempt + 1
          }/${maxRetries}...`
        );
      } else {
        // For other retryable errors, use standard exponential backoff
        delay = baseDelay * Math.pow(2, attempt); // 5s, 10s, 20s
        console.log(
          `[RETRY] Attempt ${attempt + 1} failed, retrying in ${
            delay / 1000
          }s...`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Determine if an error is retryable
function isRetryableErrorType(error) {
  const retryableMessages = [
    "temporarily unavailable",
    "service temporarily unavailable",
    "service is currently unavailable",
    "network connection issue",
    "timeout",
    "connection refused",
  ];

  return retryableMessages.some((message) =>
    error.message.toLowerCase().includes(message.toLowerCase())
  );
}

// Enhanced error message formatting
function formatErrorMessage(error, context = "") {
  let message = error.message;

  // Add context if available
  if (context) {
    message = `${context}: ${message}`;
  }

  // Add helpful suggestions based on error type
  if (message.includes("DependentServiceUnavailable")) {
    message +=
      "\n\n💡 Dica: O serviço da Tuya está temporariamente indisponível. O sistema tentará automaticamente em 5s, 25s e 125s. Se persistir, você pode usar dados em cache.";
  } else if (
    message.includes("temporarily unavailable") ||
    message.includes("service is currently unavailable")
  ) {
    message +=
      "\n\n💡 Dica: Este é um problema temporário da Tuya. O sistema tentará automaticamente em 5s, 15s e 45s. Se persistir, aguarde alguns minutos.";
  } else if (message.includes("network connection issue")) {
    message +=
      "\n\n💡 Dica: Verifique sua conexão com a internet e tente novamente.";
  } else if (message.includes("authentication expired")) {
    message += "\n\n💡 Dica: Sua sessão expirou. Faça login novamente.";
  } else if (
    message.includes("too many requests") ||
    message.includes("rate limit")
  ) {
    message +=
      "\n\n💡 Dica: Muitas requisições. O sistema aguardará automaticamente (5s, 20s, 80s) antes de tentar novamente.";
  }

  return message;
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
  this.deviceDiscovery = async () => {
    console.log(`[DEVICE DISCOVERY] Starting enhanced discovery process...`);

    // Enhanced session validation
    if (!session) {
      console.log(`[DEVICE DISCOVERY] No session found`);
      throw new Error("No active session. Please log in first.");
    }

    if (!session.token) {
      console.log(`[DEVICE DISCOVERY] No token found in session`);
      throw new Error("Session token is missing. Please log in again.");
    }

    if (!session.token.access_token) {
      console.log(`[DEVICE DISCOVERY] No access token found`);
      throw new Error("Access token is missing. Please log in again.");
    }

    // Check if token is expired
    if (session.token.expires && Date.now() / 1000 > session.token.expires) {
      console.log(`[DEVICE DISCOVERY] Token expired, clearing session`);
      session = null;
      throw new Error("Session has expired. Please log in again.");
    }

    const operation = async () => {
      console.log(`[DEVICE DISCOVERY] Making request to /skill endpoint...`);

      // Double-check session before making request
      if (!session?.token?.access_token) {
        throw new Error("Session lost during operation. Please log in again.");
      }

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

      console.log(
        `[DEVICE DISCOVERY] Raw response received:`,
        discoveryResponse.data
      );
      console.log(
        `[DEVICE DISCOVERY] Response status:`,
        discoveryResponse.status
      );

      ensureSuccess(discoveryResponse);
      console.log(`[DEVICE DISCOVERY] ensureSuccess passed successfully`);

      const payload = discoveryResponse.data.payload;
      console.log(`[DEVICE DISCOVERY] Payload extracted:`, payload);

      if (payload && payload.devices) {
        console.log(
          `[DEVICE DISCOVERY] Found ${payload.devices.length} devices in payload`
        );

        // Enhanced device processing with additional properties
        payload.devices = payload.devices
          .map((device) => {
            console.log(`[DEVICE DISCOVERY] Processing device:`, device);

            // workaround json escaped signes
            try {
              device.name = JSON.parse(`"${device.name}"`);
              console.log(
                `[DEVICE DISCOVERY] Device name parsed:`,
                device.name
              );
            } catch (e) {
              console.log(
                `[DEVICE DISCOVERY] Failed to parse device name:`,
                device.name,
                e
              );
            }

            // workaround automation type
            if (device.dev_type === "scene" && device.name.endsWith("#")) {
              device.dev_type = "automation";
              device.name = device.name.replace(/\s*#$/, "");
              console.log(
                `[DEVICE DISCOVERY] Converted scene to automation:`,
                device.name
              );
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

            console.log(`[DEVICE DISCOVERY] Processed device:`, enhancedDevice);
            return enhancedDevice;
          })
          .filter((device) => {
            // Filter out automations and scenes that should not appear as devices
            const isAutomation = device.type === "automation";
            const isScene = device.type === "scene";
            const isSceneLike =
              device.name.toLowerCase().includes("scene") ||
              device.name.toLowerCase().includes("cena") ||
              device.name.toLowerCase().includes("automation") ||
              device.name.toLowerCase().includes("automação");

            const shouldFilter = isAutomation || isScene || isSceneLike;
            console.log(
              `[DEVICE DISCOVERY] Device ${device.name} (${device.type}) - Filtered: ${shouldFilter}`
            );

            // Don't show automations, scenes, or scene-like devices in device list
            return !shouldFilter;
          });

        console.log(
          `[DEVICE DISCOVERY] Final processed devices:`,
          payload.devices
        );
      } else {
        console.log(
          `[DEVICE DISCOVERY] No devices found in payload or payload is empty`
        );
        console.log(
          `[DEVICE DISCOVERY] Payload structure:`,
          JSON.stringify(payload, null, 2)
        );
      }

      console.log(
        `[DEVICE DISCOVERY] Returning final response:`,
        discoveryResponse.data
      );
      return discoveryResponse.data;
    };

    try {
      // Try to get cached data as fallback
      const cachedDevices = JSON.parse(localStorage.getItem("devices")) || [];
      const fallbackData =
        cachedDevices.length > 0
          ? {
              payload: { devices: cachedDevices },
              header: { code: "CACHED_DATA" },
            }
          : null;

      if (fallbackData) {
        console.log(
          `[DEVICE DISCOVERY] Found ${cachedDevices.length} cached devices as fallback`
        );
      }

      return await retryWithBackoff(operation, 2, 5000, fallbackData);
    } catch (error) {
      // Enhanced error handling
      if (error.message.includes('Session lost') || 
          error.message.includes('No active session') ||
          error.message.includes('Session has expired')) {
        // Clear invalid session
        session = null;
        localStorage.removeItem('session');
        console.log(`[DEVICE DISCOVERY] Session cleared due to error:`, error.message);
      }
      
      const enhancedError = new Error(
        formatErrorMessage(error, "Erro na descoberta de dispositivos")
      );
      enhancedError.originalError = error;
      throw enhancedError;
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
            const isSceneLike =
              device.name.toLowerCase().includes("scene") ||
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

  // Get rooms and organize devices by room
  this.getRooms = async () => {
    try {
      // For now, we'll create a default room structure
      // In the future, this could be fetched from Tuya API or user configuration
      const defaultRooms = [
        { id: "living", name: "Sala de Estar", icon: "🏠", devices: [] },
        { id: "bedroom", name: "Quarto", icon: "🛏️", devices: [] },
        { id: "kitchen", name: "Cozinha", icon: "🍳", devices: [] },
        { id: "bathroom", name: "Banheiro", icon: "🚿", devices: [] },
        { id: "office", name: "Escritório", icon: "💼", devices: [] },
        { id: "garage", name: "Garagem", icon: "🚗", devices: [] },
        { id: "garden", name: "Jardim", icon: "🌱", devices: [] },
        { id: "other", name: "Outros", icon: "📦", devices: [] },
      ];

      // Load user custom rooms from localStorage
      const savedRooms = JSON.parse(localStorage.getItem("tuya_rooms")) || [];
      const customRooms = savedRooms.length > 0 ? savedRooms : defaultRooms;

      return customRooms;
    } catch (err) {
      console.error("Error getting rooms:", err);
      return [];
    }
  };

  // Save room configuration
  this.saveRooms = async (rooms) => {
    try {
      localStorage.setItem("tuya_rooms", JSON.stringify(rooms));
      return true;
    } catch (err) {
      console.error("Error saving rooms:", err);
      return false;
    }
  };

  // Organize devices by room
  this.organizeDevicesByRoom = (devices, rooms) => {
    const organizedRooms = rooms.map((room) => ({
      ...room,
      devices: [],
    }));

    // Get device-room mapping from localStorage
    const deviceRoomMap =
      JSON.parse(localStorage.getItem("tuya_device_rooms")) || {};

    devices.forEach((device) => {
      const roomId = deviceRoomMap[device.id] || "other";
      const room = organizedRooms.find((r) => r.id === roomId);
      if (room) {
        room.devices.push(device);
      }
    });

    return organizedRooms;
  };

  // Assign device to room
  this.assignDeviceToRoom = (deviceId, roomId) => {
    try {
      const deviceRoomMap =
        JSON.parse(localStorage.getItem("tuya_device_rooms")) || {};
      deviceRoomMap[deviceId] = roomId;
      localStorage.setItem("tuya_device_rooms", JSON.stringify(deviceRoomMap));
      return true;
    } catch (err) {
      console.error("Error assigning device to room:", err);
      return false;
    }
  };

  // Get device usage records and analytics
  this.getDeviceRecords = async (deviceId = null, days = 7) => {
    try {
      // Load records from localStorage (in a real app, this would come from Tuya API)
      const allRecords =
        JSON.parse(localStorage.getItem("tuya_device_records")) || [];

      if (deviceId) {
        // Filter by specific device
        return allRecords.filter((record) => record.deviceId === deviceId);
      }

      // Return all records for the specified period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return allRecords.filter((record) => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= cutoffDate;
      });
    } catch (err) {
      console.error("Error getting device records:", err);
      return [];
    }
  };

  // Log device action for analytics
  this.logDeviceAction = (deviceId, action, value, success = true) => {
    try {
      const record = {
        id: Date.now().toString(),
        deviceId,
        action,
        value,
        success,
        timestamp: new Date().toISOString(),
        userId: this.getSession()?.username || "unknown",
      };

      const allRecords =
        JSON.parse(localStorage.getItem("tuya_device_records")) || [];
      allRecords.push(record);

      // Keep only last 1000 records to avoid localStorage overflow
      if (allRecords.length > 1000) {
        allRecords.splice(0, allRecords.length - 1000);
      }

      localStorage.setItem("tuya_device_records", JSON.stringify(allRecords));
      return true;
    } catch (err) {
      console.error("Error logging device action:", err);
      return false;
    }
  };

  // Get system logs
  this.getSystemLogs = async (level = "all", limit = 100) => {
    try {
      const allLogs =
        JSON.parse(localStorage.getItem("tuya_system_logs")) || [];

      let filteredLogs = allLogs;
      if (level !== "all") {
        filteredLogs = allLogs.filter((log) => log.level === level);
      }

      // Return most recent logs
      return filteredLogs.slice(-limit);
    } catch (err) {
      console.error("Error getting system logs:", err);
      return [];
    }
  };

  // Log system event
  this.logSystemEvent = (level, message, details = {}) => {
    try {
      const logEntry = {
        id: Date.now().toString(),
        level, // 'info', 'warning', 'error', 'debug'
        message,
        details,
        timestamp: new Date().toISOString(),
        userId: this.getSession()?.username || "unknown",
      };

      const allLogs =
        JSON.parse(localStorage.getItem("tuya_system_logs")) || [];
      allLogs.push(logEntry);

      // Keep only last 500 logs to avoid localStorage overflow
      if (allLogs.length > 500) {
        allLogs.splice(0, allLogs.length - 500);
      }

      localStorage.setItem("tuya_system_logs", JSON.stringify(allLogs));

      // Also log to console for debugging
      console.log(`[${level.toUpperCase()}] ${message}`, details);

      return true;
    } catch (err) {
      console.error("Error logging system event:", err);
      return false;
    }
  };

  // Get analytics summary
  this.getAnalyticsSummary = async (days = 7) => {
    try {
      const records = await this.getDeviceRecords(null, days);
      const logs = await this.getSystemLogs("all", 1000);

      const summary = {
        totalDevices: records.reduce((acc, record) => {
          if (!acc.includes(record.deviceId)) acc.push(record.deviceId);
          return acc;
        }, []).length,
        totalActions: records.length,
        successfulActions: records.filter((r) => r.success).length,
        failedActions: records.filter((r) => !r.success).length,
        successRate:
          records.length > 0
            ? (
                (records.filter((r) => r.success).length / records.length) *
                100
              ).toFixed(1)
            : 0,
        mostActiveDevice: this.getMostActiveDevice(records),
        systemHealth: this.getSystemHealth(logs),
        period: `${days} dias`,
      };

      return summary;
    } catch (err) {
      console.error("Error getting analytics summary:", err);
      return null;
    }
  };

  // Helper: Get most active device
  this.getMostActiveDevice = (records) => {
    if (!records.length) return null;

    const deviceCounts = {};
    records.forEach((record) => {
      deviceCounts[record.deviceId] = (deviceCounts[record.deviceId] || 0) + 1;
    });

    const mostActive = Object.entries(deviceCounts).sort(
      ([, a], [, b]) => b - a
    )[0];

    return {
      deviceId: mostActive[0],
      actionCount: mostActive[1],
    };
  };

  // Helper: Get system health score
  this.getSystemHealth = (logs) => {
    if (!logs.length) return 100;

    const errorCount = logs.filter((log) => log.level === "error").length;
    const warningCount = logs.filter((log) => log.level === "warning").length;
    const totalLogs = logs.length;

    // Calculate health score (100 = perfect, 0 = critical)
    let healthScore = 100;
    healthScore -= (errorCount / totalLogs) * 50; // Errors reduce score significantly
    healthScore -= (warningCount / totalLogs) * 20; // Warnings reduce score moderately

    return Math.max(0, Math.round(healthScore));
  };

  // Real-time device monitoring
  this.startRealTimeMonitoring = async (callback) => {
    try {
      this.monitoringInterval = setInterval(async () => {
        await this.updateDeviceStates(callback);
      }, 5000); // Update every 5 seconds

      this.logSystemEvent("info", "Real-time monitoring started");
      return true;
    } catch (err) {
      console.error("Error starting real-time monitoring:", err);
      this.logSystemEvent("error", "Failed to start real-time monitoring", {
        error: err.message,
      });
      return false;
    }
  };

  // Stop real-time monitoring
  this.stopRealTimeMonitoring = () => {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.logSystemEvent("info", "Real-time monitoring stopped");
    }
  };

  // Update device states in real-time
  this.updateDeviceStates = async (callback) => {
    try {
      const session = this.getSession();
      if (!session) return;

      // Get current device states from Tuya API
      const deviceStates = await this.getDeviceStates();

      // Process each device state change
      for (const deviceState of deviceStates) {
        await this.processDeviceStateChange(deviceState);
      }

      // Call callback if provided
      if (callback && typeof callback === "function") {
        callback(deviceStates);
      }
    } catch (err) {
      console.error("Error updating device states:", err);
      this.logSystemEvent("error", "Failed to update device states", {
        error: err.message,
      });
    }
  };

  // Get device states from Tuya API
  this.getDeviceStates = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "devices",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const devices = response.data.payload.devices || [];
      const deviceStates = [];

      for (const device of devices) {
        const state = await this.getDeviceStatus(device.id);
        if (state) {
          deviceStates.push({
            deviceId: device.id,
            deviceName: device.name,
            timestamp: new Date().toISOString(),
            state: state.state,
            online: state.online,
            properties: state.properties || {},
            changes: this.detectStateChanges(device.id, state),
          });
        }
      }

      return deviceStates;
    } catch (err) {
      console.error("Error getting device states:", err);
      this.logSystemEvent("error", "Failed to get device states", {
        error: err.message,
      });
      return [];
    }
  };

  // Get individual device status
  this.getDeviceStatus = async (deviceId) => {
    try {
      const session = this.getSession();
      if (!session) return null;

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "deviceStatus",
        },
        payload: {
          accessToken: session.token.access_token,
          devId: deviceId,
        },
      });

      ensureSuccess(response);

      const status = response.data.payload;
      return {
        state: status.state,
        online: status.online,
        properties: this.parseDeviceProperties(status),
      };
    } catch (err) {
      console.error(`Error getting device status for ${deviceId}:`, err);
      return null;
    }
  };

  // Parse device properties from Tuya API response
  this.parseDeviceProperties = (status) => {
    const properties = {};

    try {
      if (status.brightness !== undefined) {
        properties.brightness = { value: status.brightness };
      }

      if (status.color !== undefined) {
        properties.color = {
          raw: status.color,
          parsed: this.parseColorValue(status.color),
        };
      }

      if (status.colorTemperature !== undefined) {
        properties.colorTemperature = { value: status.colorTemperature };
      }

      if (status.workMode !== undefined) {
        properties.workMode = { value: status.workMode };
      }

      if (status.power !== undefined) {
        properties.power = { value: status.power };
      }

      // Add any other properties from the API
      Object.keys(status).forEach((key) => {
        if (
          ![
            "state",
            "online",
            "brightness",
            "color",
            "colorTemperature",
            "workMode",
            "power",
          ].includes(key)
        ) {
          properties[key] = { value: status[key] };
        }
      });
    } catch (err) {
      console.error("Error parsing device properties:", err);
    }

    return properties;
  };

  // Parse color value from Tuya API
  this.parseColorValue = (colorData) => {
    try {
      if (typeof colorData === "string") {
        // Try to parse JSON string
        const parsed = JSON.parse(colorData);
        if (
          parsed.hue !== undefined &&
          parsed.saturation !== undefined &&
          parsed.value !== undefined
        ) {
          return parsed;
        }
      }

      if (typeof colorData === "object" && colorData.hue !== undefined) {
        return colorData;
      }

      // Default fallback
      return { hue: 0, saturation: 100, value: 100 };
    } catch (err) {
      console.error("Error parsing color value:", err);
      return { hue: 0, saturation: 100, value: 100 };
    }
  };

  // Detect state changes for a device
  this.detectStateChanges = (deviceId, currentState) => {
    try {
      const previousState =
        JSON.parse(
          localStorage.getItem(`tuya_device_${deviceId}_previous_state`)
        ) || {};
      const changes = [];

      // Check for state changes
      if (previousState.state !== currentState.state) {
        changes.push({
          type: "state",
          from: previousState.state,
          to: currentState.state,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for online status changes
      if (previousState.online !== currentState.online) {
        changes.push({
          type: "online",
          from: previousState.online,
          to: currentState.online,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for property changes
      if (currentState.properties) {
        Object.keys(currentState.properties).forEach((propKey) => {
          const currentValue = currentState.properties[propKey]?.value;
          const previousValue = previousState.properties?.[propKey]?.value;

          if (currentValue !== previousValue && previousValue !== undefined) {
            changes.push({
              type: "property",
              property: propKey,
              from: previousValue,
              to: currentValue,
              timestamp: new Date().toISOString(),
            });
          }
        });
      }

      // Save current state as previous for next comparison
      localStorage.setItem(
        `tuya_device_${deviceId}_previous_state`,
        JSON.stringify(currentState)
      );

      return changes;
    } catch (err) {
      console.error("Error detecting state changes:", err);
      return [];
    }
  };

  // Process device state change and log it
  this.processDeviceStateChange = async (deviceState) => {
    try {
      // Log state changes for analytics
      if (deviceState.changes && deviceState.changes.length > 0) {
        for (const change of deviceState.changes) {
          await this.logDeviceAction(
            deviceState.deviceId,
            `state_change_${change.type}`,
            `${change.from} → ${change.to}`,
            true
          );

          // Log system event for significant changes
          this.logSystemEvent(
            "info",
            `Device ${deviceState.deviceName} ${change.type} changed`,
            {
              deviceId: deviceState.deviceId,
              change: change,
            }
          );
        }
      }

      // Update device records with current state
      await this.updateDeviceRecord(deviceState);
    } catch (err) {
      console.error("Error processing device state change:", err);
    }
  };

  // Update device record with current state
  this.updateDeviceRecord = async (deviceState) => {
    try {
      const record = {
        id: Date.now().toString(),
        deviceId: deviceState.deviceId,
        deviceName: deviceState.deviceName,
        action: "status_update",
        value: JSON.stringify(deviceState),
        success: true,
        timestamp: deviceState.timestamp,
        userId: "tuya_api",
        source: "real_time_monitoring",
      };

      const allRecords =
        JSON.parse(localStorage.getItem("tuya_device_records")) || [];
      allRecords.push(record);

      // Keep only last 1000 records
      if (allRecords.length > 1000) {
        allRecords.splice(0, allRecords.length - 1000);
      }

      localStorage.setItem("tuya_device_records", JSON.stringify(allRecords));
    } catch (err) {
      console.error("Error updating device record:", err);
    }
  };

  // Get device usage statistics from Tuya API
  this.getDeviceUsageStats = async (deviceId, period = "day") => {
    try {
      const session = this.getSession();
      if (!session) return null;

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "deviceUsage",
        },
        payload: {
          accessToken: session.token.access_token,
          devId: deviceId,
          period: period, // day, week, month
        },
      });

      ensureSuccess(response);

      const stats = response.data.payload;

      // Log the usage statistics
      this.logSystemEvent(
        "info",
        `Retrieved usage stats for device ${deviceId}`,
        {
          deviceId,
          period,
          stats,
        }
      );

      return stats;
    } catch (err) {
      console.error(`Error getting device usage stats for ${deviceId}:`, err);
      this.logSystemEvent(
        "error",
        `Failed to get usage stats for device ${deviceId}`,
        { error: err.message }
      );
      return null;
    }
  };

  // Get system statistics from Tuya API
  this.getSystemStats = async () => {
    try {
      const session = this.getSession();
      if (!session) return null;

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "systemStats",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const stats = response.data.payload;

      // Log system statistics
      this.logSystemEvent("info", "Retrieved system statistics from Tuya API", {
        stats,
      });

      return stats;
    } catch (err) {
      console.error("Error getting system stats:", err);
      this.logSystemEvent("error", "Failed to get system statistics", {
        error: err.message,
      });
      return null;
    }
  };

  // Enhanced real-time monitoring for Tuya events
  this.startTuyaEventMonitoring = async (callback) => {
    try {
      this.eventMonitoringInterval = setInterval(async () => {
        await this.captureTuyaEvents(callback);
      }, 3000); // Update every 3 seconds for real-time events

      this.logSystemEvent("info", "Tuya event monitoring started");
      return true;
    } catch (err) {
      console.error("Error starting Tuya event monitoring:", err);
      this.logSystemEvent("error", "Failed to start Tuya event monitoring", {
        error: err.message,
      });
      return false;
    }
  };

  // Stop Tuya event monitoring
  this.stopTuyaEventMonitoring = () => {
    if (this.eventMonitoringInterval) {
      clearInterval(this.eventMonitoringInterval);
      this.eventMonitoringInterval = null;
      this.logSystemEvent("info", "Tuya event monitoring stopped");
    }
  };

  // Capture all Tuya events in real-time
  this.captureTuyaEvents = async (callback) => {
    try {
      const session = this.getSession();
      if (!session) return;

      // Capture different types of events
      const events = {
        deviceStatus: await this.getDeviceStatusEvents(),
        scenes: await this.getSceneExecutionEvents(),
        automations: await this.getAutomationEvents(),
        alerts: await this.getSystemAlerts(),
        notifications: await this.getSystemNotifications(),
        deviceChanges: await this.getDeviceChangeEvents(),
      };

      // Process and log all events
      await this.processTuyaEvents(events);

      // Call callback if provided
      if (callback && typeof callback === "function") {
        callback(events);
      }
    } catch (err) {
      console.error("Error capturing Tuya events:", err);
      this.logSystemEvent("error", "Failed to capture Tuya events", {
        error: err.message,
      });
    }
  };

  // Get device status events (online/offline, state changes)
  this.getDeviceStatusEvents = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "deviceStatus",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const devices = response.data.payload.devices || [];
      const events = [];

      for (const device of devices) {
        const currentStatus = {
          deviceId: device.id,
          deviceName: device.name,
          online: device.online,
          state: device.state,
          lastSeen: device.lastSeen,
          timestamp: new Date().toISOString(),
        };

        // Check for status changes
        const previousStatus = this.getPreviousDeviceStatus(device.id);
        const changes = this.detectDeviceStatusChanges(
          previousStatus,
          currentStatus
        );

        if (changes.length > 0) {
          events.push({
            type: "device_status_change",
            device: currentStatus,
            changes: changes,
            timestamp: new Date().toISOString(),
          });
        }

        // Update previous status
        this.updatePreviousDeviceStatus(device.id, currentStatus);
      }

      return events;
    } catch (err) {
      console.error("Error getting device status events:", err);
      return [];
    }
  };

  // Get scene execution events
  this.getSceneExecutionEvents = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "sceneExecutions",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const executions = response.data.payload.executions || [];
      const events = [];

      for (const execution of executions) {
        // Check if this is a new execution
        if (!this.isSceneExecutionKnown(execution.id)) {
          events.push({
            type: "scene_executed",
            sceneId: execution.id,
            sceneName: execution.name,
            executedBy: execution.executedBy || "system",
            timestamp: execution.timestamp || new Date().toISOString(),
            success: execution.success !== false,
            details: execution,
          });

          // Mark as known
          this.markSceneExecutionAsKnown(execution.id);
        }
      }

      return events;
    } catch (err) {
      console.error("Error getting scene execution events:", err);
      return [];
    }
  };

  // Get automation events
  this.getAutomationEvents = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "automationEvents",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const automations = response.data.payload.automations || [];
      const events = [];

      for (const automation of automations) {
        // Check for automation triggers
        if (
          automation.lastTriggered &&
          !this.isAutomationEventKnown(automation.id, automation.lastTriggered)
        ) {
          events.push({
            type: "automation_triggered",
            automationId: automation.id,
            automationName: automation.name,
            trigger: automation.trigger,
            lastTriggered: automation.lastTriggered,
            timestamp: new Date().toISOString(),
            conditions: automation.conditions,
            actions: automation.actions,
          });

          // Mark as known
          this.markAutomationEventAsKnown(
            automation.id,
            automation.lastTriggered
          );
        }
      }

      return events;
    } catch (err) {
      console.error("Error getting automation events:", err);
      return [];
    }
  };

  // Get system alerts
  this.getSystemAlerts = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "systemAlerts",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const alerts = response.data.payload.alerts || [];
      const events = [];

      for (const alert of alerts) {
        // Check if this is a new alert
        if (!this.isAlertKnown(alert.id)) {
          events.push({
            type: "system_alert",
            alertId: alert.id,
            level: alert.level || "info",
            message: alert.message,
            category: alert.category,
            timestamp: alert.timestamp || new Date().toISOString(),
            acknowledged: alert.acknowledged || false,
            details: alert,
          });

          // Mark as known
          this.markAlertAsKnown(alert.id);
        }
      }

      return events;
    } catch (err) {
      console.error("Error getting system alerts:", err);
      return [];
    }
  };

  // Get system notifications
  this.getSystemNotifications = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "notifications",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const notifications = response.data.payload.notifications || [];
      const events = [];

      for (const notification of notifications) {
        // Check if this is a new notification
        if (!this.isNotificationKnown(notification.id)) {
          events.push({
            type: "system_notification",
            notificationId: notification.id,
            title: notification.title,
            message: notification.message,
            priority: notification.priority || "normal",
            timestamp: notification.timestamp || new Date().toISOString(),
            read: notification.read || false,
            category: notification.category,
            details: notification,
          });

          // Mark as known
          this.markNotificationAsKnown(notification.id);
        }
      }

      return events;
    } catch (err) {
      console.error("Error getting system notifications:", err);
      return [];
    }
  };

  // Get device change events (properties, settings, etc.)
  this.getDeviceChangeEvents = async () => {
    try {
      const session = this.getSession();
      if (!session) return [];

      const response = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "query",
          name: "deviceChanges",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(response);

      const changes = response.data.payload.changes || [];
      const events = [];

      for (const change of changes) {
        // Check if this is a new change
        if (!this.isDeviceChangeKnown(change.id)) {
          events.push({
            type: "device_change",
            changeId: change.id,
            deviceId: change.deviceId,
            deviceName: change.deviceName,
            changeType: change.changeType,
            property: change.property,
            oldValue: change.oldValue,
            newValue: change.newValue,
            timestamp: change.timestamp || new Date().toISOString(),
            source: change.source || "unknown",
            details: change,
          });

          // Mark as known
          this.markDeviceChangeAsKnown(change.id);
        }
      }

      return events;
    } catch (err) {
      console.error("Error getting device change events:", err);
      return [];
    }
  };

  // Helper functions for tracking known events
  this.getPreviousDeviceStatus = (deviceId) => {
    try {
      return (
        JSON.parse(localStorage.getItem(`tuya_device_status_${deviceId}`)) ||
        null
      );
    } catch (err) {
      return null;
    }
  };

  this.updatePreviousDeviceStatus = (deviceId, status) => {
    try {
      localStorage.setItem(
        `tuya_device_status_${deviceId}`,
        JSON.stringify(status)
      );
    } catch (err) {
      console.error("Error updating previous device status:", err);
    }
  };

  this.detectDeviceStatusChanges = (previous, current) => {
    if (!previous) return [];

    const changes = [];

    if (previous.online !== current.online) {
      changes.push({
        type: "online_status",
        from: previous.online,
        to: current.online,
        message: current.online ? "Device came online" : "Device went offline",
      });
    }

    if (previous.state !== current.state) {
      changes.push({
        type: "power_state",
        from: previous.state,
        to: current.state,
        message: `Device ${current.state ? "turned on" : "turned off"}`,
      });
    }

    return changes;
  };

  this.isSceneExecutionKnown = (executionId) => {
    try {
      const known =
        JSON.parse(localStorage.getItem("tuya_known_scene_executions")) || [];
      return known.includes(executionId);
    } catch (err) {
      return false;
    }
  };

  this.markSceneExecutionAsKnown = (executionId) => {
    try {
      const known =
        JSON.parse(localStorage.getItem("tuya_known_scene_executions")) || [];
      known.push(executionId);
      // Keep only last 1000 known executions
      if (known.length > 1000) known.splice(0, known.length - 1000);
      localStorage.setItem(
        "tuya_known_scene_executions",
        JSON.stringify(known)
      );
    } catch (err) {
      console.error("Error marking scene execution as known:", err);
    }
  };

  this.isAutomationEventKnown = (automationId, lastTriggered) => {
    try {
      const known =
        JSON.parse(
          localStorage.getItem(`tuya_known_automation_${automationId}`)
        ) || [];
      return known.includes(lastTriggered);
    } catch (err) {
      return false;
    }
  };

  this.markAutomationEventAsKnown = (automationId, lastTriggered) => {
    try {
      const known =
        JSON.parse(
          localStorage.getItem(`tuya_known_automation_${automationId}`)
        ) || [];
      known.push(lastTriggered);
      // Keep only last 100 known triggers per automation
      if (known.length > 100) known.splice(0, known.length - 100);
      localStorage.setItem(
        `tuya_known_automation_${automationId}`,
        JSON.stringify(known)
      );
    } catch (err) {
      console.error("Error marking automation event as known:", err);
    }
  };

  this.isAlertKnown = (alertId) => {
    try {
      const known = JSON.parse(localStorage.getItem("tuya_known_alerts")) || [];
      return known.includes(alertId);
    } catch (err) {
      return false;
    }
  };

  this.markAlertAsKnown = (alertId) => {
    try {
      const known = JSON.parse(localStorage.getItem("tuya_known_alerts")) || [];
      known.push(alertId);
      // Keep only last 500 known alerts
      if (known.length > 500) known.splice(0, known.length - 500);
      localStorage.setItem("tuya_known_alerts", JSON.stringify(known));
    } catch (err) {
      console.error("Error marking alert as known:", err);
    }
  };

  this.isNotificationKnown = (notificationId) => {
    try {
      const known =
        JSON.parse(localStorage.getItem("tuya_known_notifications")) || [];
      return known.includes(notificationId);
    } catch (err) {
      return false;
    }
  };

  this.markNotificationAsKnown = (notificationId) => {
    try {
      const known =
        JSON.parse(localStorage.getItem("tuya_known_notifications")) || [];
      known.push(notificationId);
      // Keep only last 1000 known notifications
      if (known.length > 1000) known.splice(0, known.length - 1000);
      localStorage.setItem("tuya_known_notifications", JSON.stringify(known));
    } catch (err) {
      console.error("Error marking notification as known:", err);
    }
  };

  this.isDeviceChangeKnown = (changeId) => {
    try {
      const known =
        JSON.parse(localStorage.getItem("tuya_known_device_changes")) || [];
      return known.includes(changeId);
    } catch (err) {
      return false;
    }
  };

  this.markDeviceChangeAsKnown = (changeId) => {
    try {
      const known =
        JSON.parse(localStorage.getItem("tuya_known_device_changes")) || [];
      known.push(changeId);
      // Keep only last 1000 known changes
      if (known.length > 1000) known.splice(0, known.length - 1000);
      localStorage.setItem("tuya_known_device_changes", JSON.stringify(known));
    } catch (err) {
      console.error("Error marking device change as known:", err);
    }
  };

  // Process all Tuya events and log them
  this.processTuyaEvents = async (events) => {
    try {
      let totalEvents = 0;

      // Process each type of events
      Object.keys(events).forEach((eventType) => {
        const eventList = events[eventType];
        if (eventList && eventList.length > 0) {
          totalEvents += eventList.length;

          // Log each event
          eventList.forEach((event) => {
            this.logTuyaEvent(event);
          });
        }
      });

      // Log summary if there are events
      if (totalEvents > 0) {
        this.logSystemEvent("info", `Processed ${totalEvents} Tuya events`, {
          eventCounts: Object.keys(events).reduce((acc, key) => {
            acc[key] = events[key]?.length || 0;
            return acc;
          }, {}),
        });
      }
    } catch (err) {
      console.error("Error processing Tuya events:", err);
      this.logSystemEvent("error", "Failed to process Tuya events", {
        error: err.message,
      });
    }
  };

  // Log Tuya event to system
  this.logTuyaEvent = (event) => {
    try {
      // Create enhanced log entry
      const logEntry = {
        id: Date.now().toString(),
        level: this.getEventLevel(event),
        message: this.formatEventMessage(event),
        details: event,
        timestamp: event.timestamp || new Date().toISOString(),
        userId: "tuya_api",
        source: "real_time_monitoring",
        eventType: event.type,
      };

      // Add to system logs
      const allLogs =
        JSON.parse(localStorage.getItem("tuya_system_logs")) || [];
      allLogs.push(logEntry);

      // Keep only last 1000 logs
      if (allLogs.length > 1000) {
        allLogs.splice(0, allLogs.length - 1000);
      }

      localStorage.setItem("tuya_system_logs", JSON.stringify(allLogs));

      // Also log to console for debugging
      console.log(`[TUYA EVENT] ${logEntry.message}`, event);
    } catch (err) {
      console.error("Error logging Tuya event:", err);
    }
  };

  // Determine event level based on event type
  this.getEventLevel = (event) => {
    switch (event.type) {
      case "system_alert":
        return event.level || "warning";
      case "device_status_change":
        return event.changes?.some((c) => c.type === "online_status" && !c.to)
          ? "warning"
          : "info";
      case "automation_triggered":
        return "info";
      case "scene_executed":
        return "info";
      case "device_change":
        return "info";
      default:
        return "info";
    }
  };

  // Format event message for display
  this.formatEventMessage = (event) => {
    switch (event.type) {
      case "device_status_change":
        const changeMessages = event.changes?.map((c) => c.message) || [];
        return `Device ${
          event.device.deviceName
        } status changed: ${changeMessages.join(", ")}`;

      case "scene_executed":
        return `Scene "${event.sceneName}" executed by ${event.executedBy}`;

      case "automation_triggered":
        return `Automation "${event.automationName}" triggered`;

      case "system_alert":
        return `System Alert [${event.level.toUpperCase()}]: ${event.message}`;

      case "system_notification":
        return `Notification: ${event.title} - ${event.message}`;

      case "device_change":
        return `Device ${event.deviceName} ${event.changeType}: ${event.property} changed from ${event.oldValue} to ${event.newValue}`;

      default:
        return `Tuya Event: ${event.type}`;
    }
  };

  // Device control rate limiting and debouncing
  this.deviceControlQueue = new Map(); // Track pending controls per device
  this.deviceControlCooldown = new Map(); // Track cooldown periods per device
  this.CONTROL_COOLDOWN_MS = 2000; // 2 seconds cooldown between controls
  this.MAX_QUEUED_CONTROLS = 3; // Maximum queued controls per device

  // Enhanced device control with rate limiting
  this.deviceControlWithRateLimit = async (
    deviceId,
    action,
    fieldName,
    fieldValue
  ) => {
    try {
      // Check if device is in cooldown
      const cooldownUntil = this.deviceControlCooldown.get(deviceId);
      if (cooldownUntil && Date.now() < cooldownUntil) {
        const remainingMs = cooldownUntil - Date.now();
        throw new Error(
          `Dispositivo em cooldown. Aguarde ${Math.ceil(
            remainingMs / 1000
          )} segundos antes de tentar novamente.`
        );
      }

      // Check if there are too many queued controls
      const queuedControls = this.deviceControlQueue.get(deviceId) || [];
      if (queuedControls.length >= this.MAX_QUEUED_CONTROLS) {
        throw new Error(
          `Muitas operações pendentes para este dispositivo. Aguarde as operações anteriores terminarem.`
        );
      }

      // Add control to queue
      const controlId = Date.now().toString();
      const controlPromise = new Promise((resolve, reject) => {
        queuedControls.push({
          id: controlId,
          action,
          fieldName,
          fieldValue,
          resolve,
          reject,
          timestamp: Date.now(),
        });
      });

      this.deviceControlQueue.set(deviceId, queuedControls);

      // Process queue if this is the only item
      if (queuedControls.length === 1) {
        this.processDeviceControlQueue(deviceId);
      }

      // Wait for this control to be processed
      return await controlPromise;
    } catch (err) {
      // Log the rate limiting error
      this.logSystemEvent(
        "warning",
        `Rate limiting applied to device ${deviceId}`,
        {
          deviceId,
          action,
          error: err.message,
        }
      );
      throw err;
    }
  };

  // Process device control queue
  this.processDeviceControlQueue = async (deviceId) => {
    const queuedControls = this.deviceControlQueue.get(deviceId) || [];

    if (queuedControls.length === 0) return;

    try {
      // Get the next control from queue
      const control = queuedControls[0];

      // Execute the control
      const result = await this.deviceControl(
        control.deviceId || deviceId,
        control.action,
        control.fieldName,
        control.fieldValue
      );

      // Resolve the promise
      control.resolve(result);

      // Remove from queue
      queuedControls.splice(0, 1);
      this.deviceControlQueue.set(deviceId, queuedControls);

      // Set cooldown period
      this.deviceControlCooldown.set(
        deviceId,
        Date.now() + this.CONTROL_COOLDOWN_MS
      );

      // Log successful control
      this.logSystemEvent("info", `Device control executed successfully`, {
        deviceId,
        action: control.action,
        queueLength: queuedControls.length,
      });

      // Process next control if any
      if (queuedControls.length > 0) {
        // Wait for cooldown before processing next control
        setTimeout(() => {
          this.processDeviceControlQueue(deviceId);
        }, this.CONTROL_COOLDOWN_MS);
      }
    } catch (err) {
      // Get the failed control
      const control = queuedControls[0];

      // Reject the promise
      control.reject(err);

      // Remove from queue
      queuedControls.splice(0, 1);
      this.deviceControlQueue.set(deviceId, queuedControls);

      // Set cooldown period even on failure
      this.deviceControlCooldown.set(
        deviceId,
        Date.now() + this.CONTROL_COOLDOWN_MS
      );

      // Log the error
      this.logSystemEvent("error", `Device control failed`, {
        deviceId,
        action: control.action,
        error: err.message,
        queueLength: queuedControls.length,
      });

      // Process next control if any (with delay)
      if (queuedControls.length > 0) {
        setTimeout(() => {
          this.processDeviceControlQueue(deviceId);
        }, this.CONTROL_COOLDOWN_MS);
      }
    }
  };

  // Clear device control queue (useful for cleanup)
  this.clearDeviceControlQueue = (deviceId) => {
    const queuedControls = this.deviceControlQueue.get(deviceId) || [];

    // Reject all pending controls
    queuedControls.forEach((control) => {
      control.reject(new Error("Device control queue cleared"));
    });

    // Clear the queue
    this.deviceControlQueue.delete(deviceId);
    this.deviceControlCooldown.delete(deviceId);

    this.logSystemEvent("info", `Device control queue cleared`, { deviceId });
  };

  // Get device control queue status
  this.getDeviceControlQueueStatus = (deviceId) => {
    const queuedControls = this.deviceControlQueue.get(deviceId) || [];
    const cooldownUntil = this.deviceControlCooldown.get(deviceId);

    return {
      queuedCount: queuedControls.length,
      inCooldown: cooldownUntil && Date.now() < cooldownUntil,
      cooldownRemaining: cooldownUntil
        ? Math.max(0, cooldownUntil - Date.now())
        : 0,
      canAcceptNewControl:
        queuedControls.length < this.MAX_QUEUED_CONTROLS &&
        (!cooldownUntil || Date.now() >= cooldownUntil),
    };
  };

  // Enhanced toggle device function with rate limiting
  this.toggleDeviceWithRateLimit = async (deviceId, currentState) => {
    try {
      const newState = !currentState;

      // Check queue status before proceeding
      const queueStatus = this.getDeviceControlQueueStatus(deviceId);
      if (!queueStatus.canAcceptNewControl) {
        if (queueStatus.inCooldown) {
          throw new Error(
            `Dispositivo em cooldown. Aguarde ${Math.ceil(
              queueStatus.cooldownRemaining / 1000
            )} segundos.`
          );
        } else {
          throw new Error(
            `Fila de controle cheia. Aguarde as operações anteriores terminarem.`
          );
        }
      }

      // Use rate-limited control
      const result = await this.deviceControlWithRateLimit(
        deviceId,
        "turnOnOff",
        "state",
        newState
      );

      // Log successful toggle
      this.logSystemEvent("info", `Device toggled successfully`, {
        deviceId,
        fromState: currentState,
        toState: newState,
      });

      return result;
    } catch (err) {
      // Log failed toggle
      this.logSystemEvent("error", `Device toggle failed`, {
        deviceId,
        currentState,
        error: err.message,
      });

      throw err;
    }
  };

  // Enhanced scene trigger with rate limiting
  this.triggerSceneWithRateLimit = async (sceneId) => {
    try {
      // Check if scene is already being triggered
      const sceneKey = `scene_${sceneId}`;
      const cooldownUntil = this.deviceControlCooldown.get(sceneKey);

      if (cooldownUntil && Date.now() < cooldownUntil) {
        const remainingMs = cooldownUntil - Date.now();
        throw new Error(
          `Cena em cooldown. Aguarde ${Math.ceil(
            remainingMs / 1000
          )} segundos antes de tentar novamente.`
        );
      }

      // Set cooldown for scene
      this.deviceControlCooldown.set(
        sceneKey,
        Date.now() + this.CONTROL_COOLDOWN_MS
      );

      // Execute scene
      const result = await this.triggerScene(sceneId);

      // Log successful scene trigger
      this.logSystemEvent("info", `Scene triggered successfully`, {
        sceneId,
        cooldownSet: true,
      });

      return result;
    } catch (err) {
      // Log failed scene trigger
      this.logSystemEvent("error", `Scene trigger failed`, {
        sceneId,
        error: err.message,
      });

      throw err;
    }
  };
}

export default {
  HomeAssistantClient,
};
