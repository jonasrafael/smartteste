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
        throw new Error(
          "Tuya service temporarily unavailable. Please try again in a few minutes."
        );
      case "TOKEN_EXPIRED":
        console.log(`[ENSURE SUCCESS] TOKEN_EXPIRED error detected`);
        throw new Error("Authentication expired. Please log in again.");
      case "RATE_LIMIT_EXCEEDED":
        console.log(`[ENSURE SUCCESS] RATE_LIMIT_EXCEEDED error detected`);
        throw new Error("Too many requests. Please wait before trying again.");
      case "SERVICE_UNAVAILABLE":
        console.log(`[ENSURE SUCCESS] SERVICE_UNAVAILABLE error detected`);
        throw new Error("Tuya service is currently unavailable. Please try again later.");
      case "NETWORK_ERROR":
        console.log(`[ENSURE SUCCESS] NETWORK_ERROR error detected`);
        throw new Error("Network connection issue. Please check your internet connection.");
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

// Enhanced retry strategy with Tuya-specific timing recommendations
async function retryWithBackoff(operation, maxRetries = 2, baseDelay = 5000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryableError = isRetryableErrorType(error);
      
      if (isLastAttempt || !isRetryableError) {
        throw error;
      }
      
      // Tuya-specific retry strategy with longer delays
      let delay;
      if (error.message.includes('DependentServiceUnavailable') || 
          error.message.includes('temporarily unavailable')) {
        // For service unavailability, use longer delays
        delay = baseDelay * Math.pow(3, attempt); // 5s, 15s, 45s
        console.log(`[RETRY] Service unavailable detected. Waiting ${delay/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      } else if (error.message.includes('rate limit') || 
                 error.message.includes('too many requests')) {
        // For rate limiting, use even longer delays
        delay = baseDelay * Math.pow(4, attempt); // 5s, 20s, 80s
        console.log(`[RETRY] Rate limit detected. Waiting ${delay/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      } else {
        // For other retryable errors, use standard exponential backoff
        delay = baseDelay * Math.pow(2, attempt); // 5s, 10s, 20s
        console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${delay/1000}s...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Determine if an error is retryable
function isRetryableErrorType(error) {
  const retryableMessages = [
    'temporarily unavailable',
    'service temporarily unavailable',
    'service is currently unavailable',
    'network connection issue',
    'timeout',
    'connection refused'
  ];
  
  return retryableMessages.some(message => 
    error.message.toLowerCase().includes(message.toLowerCase())
  );
}

// Enhanced error message formatting
function formatErrorMessage(error, context = '') {
  let message = error.message;
  
  // Add context if available
  if (context) {
    message = `${context}: ${message}`;
  }
  
  // Add helpful suggestions based on error type
  if (message.includes('temporarily unavailable') || message.includes('service is currently unavailable')) {
    message += '\n\n💡 Dica: Este é um problema temporário da Tuya. Tente novamente em alguns minutos.';
  } else if (message.includes('network connection issue')) {
    message += '\n\n💡 Dica: Verifique sua conexão com a internet e tente novamente.';
  } else if (message.includes('authentication expired')) {
    message += '\n\n💡 Dica: Sua sessão expirou. Faça login novamente.';
  } else if (message.includes('too many requests')) {
    message += '\n\n💡 Dica: Muitas requisições. Aguarde um pouco antes de tentar novamente.';
  }
  
  return message;
}

function HomeAssistantClient(session) {
  let client;
  if (session) {
    client = createClient(session.region);
  }

  function createClient(region) {
    return axios.create({ 
      baseURL: "/api/homeassistant", 
      params: { region },
      timeout: 30000 // 30 second timeout
    });
  }

  function normalizeToken(token) {
    const result = {
      ...token,
      expires: Math.trunc(Date.now() / 1000) + token.expires_in,
    };
    delete result.expires_in;
    return result;
  }

  this.login = async (username, password, region = defaults.region) => {
    try {
      const loginResponse = await client.post("/auth", {
        username,
        password,
        countryCode: region === "eu" ? "55" : "1",
        bizType: "smart_life",
        from: "tuya",
      });

      ensureSuccess(loginResponse);
      const token = normalizeToken(loginResponse.data.result);
      session = { token, region };
      return token;
    } catch (error) {
      const enhancedError = new Error(formatErrorMessage(error, 'Erro no login'));
      enhancedError.originalError = error;
      throw enhancedError;
    }
  };

  this.getSession = () => {
    if (!session?.token) return null;
    if (Date.now() / 1000 > session.token.expires) {
      session = null;
      return null;
    }
    return session;
  };

  this.logout = () => {
    session = null;
  };

  this.deviceDiscovery = async () => {
    console.log(`[DEVICE DISCOVERY] Starting enhanced discovery process...`);
    
    if (!session?.token?.access_token) {
      throw new Error("No active session. Please log in first.");
    }

    const operation = async () => {
      console.log(`[DEVICE DISCOVERY] Making request to /skill endpoint...`);

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

        // fix payload data
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

            const processedDevice = {
              id: device.id,
              name: device.name,
              type: device.dev_type,
              data: device.data,
              icon: device.icon,
            };

            console.log(
              `[DEVICE DISCOVERY] Processed device:`,
              processedDevice
            );
            return processedDevice;
          })
          .filter((device) => {
            // Enhanced filtering for scenes and automations
            const isScene = device.type === "scene";
            const isSceneLike =
              device.name.toLowerCase().includes("scene") ||
              device.name.toLowerCase().includes("cena");
            const isAutomation =
              device.type === "automation" ||
              device.name.toLowerCase().includes("automation") ||
              device.name.toLowerCase().includes("automação");

            const shouldFilter = isAutomation || isScene || isSceneLike;
            console.log(
              `[DEVICE DISCOVERY] Device ${device.name} (${device.type}) - Filtered: ${shouldFilter}`
            );
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
      return await retryWithBackoff(operation, 2, 5000);
    } catch (error) {
      const enhancedError = new Error(formatErrorMessage(error, 'Erro na descoberta de dispositivos'));
      enhancedError.originalError = error;
      throw enhancedError;
    }
  };

  // Enhanced device control with better error handling
  this.deviceControl = async (deviceId, action, fieldValue, fieldName) => {
    // for testing purpose only
    if (deviceId === 0) {
      return { header: { code: "SUCCESS" } };
    }

    if (!session?.token?.access_token) {
      throw new Error("No active session. Please log in first.");
    }

    fieldName = fieldName || "value";

    if (
      action === "turnOnOff" &&
      fieldName === "value" &&
      typeof fieldValue === "boolean"
    ) {
      fieldValue = fieldValue ? 1 : 0;
    }

    try {
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
      return controlResponse.data;
    } catch (error) {
      const enhancedError = new Error(formatErrorMessage(error, 'Erro no controle do dispositivo'));
      enhancedError.originalError = error;
      throw enhancedError;
    }
  };

  // Enhanced scene discovery
  this.getScenes = async () => {
    console.log(`[SCENE DISCOVERY] Starting scene discovery...`);
    
    if (!session?.token?.access_token) {
      throw new Error("No active session. Please log in first.");
    }

    const operation = async () => {
      const sceneResponse = await client.post("/skill", {
        header: {
          payloadVersion: 1,
          namespace: "discovery",
          name: "Discovery",
        },
        payload: {
          accessToken: session.token.access_token,
        },
      });

      ensureSuccess(sceneResponse);
      const payload = sceneResponse.data.payload;

      if (payload && payload.devices) {
        return payload.devices
          .filter((device) => {
            const isScene = device.dev_type === "scene";
            const isSceneLike =
              device.name.toLowerCase().includes("scene") ||
              device.name.toLowerCase().includes("cena");
            const isAutomation =
              device.dev_type === "automation" ||
              device.name.toLowerCase().includes("automation") ||
              device.name.toLowerCase().includes("automação");

            return isScene || isSceneLike || isAutomation;
          })
          .map((scene) => ({
            id: scene.id,
            name: scene.name,
            type: scene.dev_type,
            data: scene.data,
            icon: scene.icon,
          }));
      }
      
      return [];
    };

    try {
      return await retryWithBackoff(operation, 2, 1000);
    } catch (error) {
      const enhancedError = new Error(formatErrorMessage(error, 'Erro na descoberta de cenas'));
      enhancedError.originalError = error;
      throw enhancedError;
    }
  };
}

export default {
  HomeAssistantClient,
};
