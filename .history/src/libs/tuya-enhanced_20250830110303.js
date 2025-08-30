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
          .filter((device) => {
            // Filter out automations and scenes that should not appear as devices
            const isAutomation = device.type === "automation";
            const isScene = device.type === "scene";
            const isSceneLike =
              device.name.toLowerCase().includes("scene") ||
              device.name.toLowerCase().includes("cena") ||
              device.name.toLowerCase().includes("automation") ||
              device.name.toLowerCase().includes("automação");

            // Don't show automations, scenes, or scene-like devices in device list
            return !isAutomation && !isScene && !isSceneLike;
          });
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
}

export default {
  HomeAssistantClient,
};
