import axios from 'axios'

const defaults = {
  region: 'eu'
}

function ensureSuccess (response) {
  console.log(`[ENSURE SUCCESS] Starting validation for response:`, response.data);
  
  const data = response.data
  if (typeof data !== 'object') {
    console.log(`[ENSURE SUCCESS] Data is not an object:`, typeof data, data);
    throw new Error(data)
  }
  
  console.log(`[ENSURE SUCCESS] Data is object, checking for access_token...`);
  if (data.access_token) {
    console.log(`[ENSURE SUCCESS] Found access_token, returning early`);
    return
  }
  
  console.log(`[ENSURE SUCCESS] No access_token, checking responseStatus...`);
  if (data.responseStatus === 'error') {
    console.log(`[ENSURE SUCCESS] Found responseStatus error:`, data.errorMsg);
    throw new Error(data.errorMsg)
  }
  
  console.log(`[ENSURE SUCCESS] Checking header and code...`);
  // Handle specific Tuya API errors
  if (data.header && data.header.code) {
    console.log(`[ENSURE SUCCESS] Header code found:`, data.header.code);
    console.log(`[ENSURE SUCCESS] Header message:`, data.header.msg);
    
    switch (data.header.code) {
      case 'SUCCESS':
        console.log(`[ENSURE SUCCESS] SUCCESS code found, returning`);
        return // Success case
      case 'DependentServiceUnavailable':
        console.log(`[ENSURE SUCCESS] DependentServiceUnavailable error detected`);
        throw new Error('Tuya service temporarily unavailable. Please try again in a few minutes.')
      case 'TOKEN_EXPIRED':
        console.log(`[ENSURE SUCCESS] TOKEN_EXPIRED error detected`);
        throw new Error('Authentication expired. Please log in again.')
      case 'RATE_LIMIT_EXCEEDED':
        console.log(`[ENSURE SUCCESS] RATE_LIMIT_EXCEEDED error detected`);
        throw new Error('Too many requests. Please wait before trying again.')
      default:
        console.log(`[ENSURE SUCCESS] Unknown error code:`, data.header.code);
        if (data.header.msg) {
          console.log(`[ENSURE SUCCESS] Throwing error with message:`, data.header.msg);
          throw new Error(data.header.msg)
        } else {
          console.log(`[ENSURE SUCCESS] Throwing generic error for code:`, data.header.code);
          throw new Error(`API Error: ${data.header.code}`)
        }
    }
  }
  
  console.log(`[ENSURE SUCCESS] No header found, checking if header exists...`);
  // Fallback for missing header
  if (!data.header) {
    console.log(`[ENSURE SUCCESS] No header found, throwing error`);
    throw new Error('Invalid response format from Tuya API')
  }
  
  console.log(`[ENSURE SUCCESS] Validation completed successfully`);
}

function HomeAssistantClient (session) {
  let client
  if (session) {
    client = createClient(session.region)
  }

  function createClient (region) {
    return axios.create({ baseURL: '/api/homeassistant', params: { region } })
  }

  function normalizeToken (token) {
    const result = {
      ...token,
      expires: Math.trunc((Date.now() / 1000)) + token.expires_in
    }
    delete result.expires_in
    return result
  }

  this.login = async (userName, password, region) => {
    region = region || defaults.region

    client = createClient(region)

    const authResponse = await client.post('/auth.do', new URLSearchParams({
      userName,
      password,
      countryCode: '00',
      bizType: 'smart_life',
      from: 'tuya'
    }))
    console.debug('auth.do', userName, authResponse.data)
    ensureSuccess(authResponse)

    session = {
      region,
      token: normalizeToken(authResponse.data)
    }
  }

  this.refreshAuthToken = async () => {
    const accessResponse = await client.post('/access.do', {
      grant_type: 'refresh_token',
      refresh_token: session.token.refresh_token,
      rand: Math.random()
    })
    console.debug('access.do', accessResponse.data)
    ensureSuccess(accessResponse)

    session.token = normalizeToken(accessResponse.data)
  }

  this.getSession = () => session

  this.dropSession = () => { session = null }

  this.deviceDiscovery = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    console.log(`[DEVICE DISCOVERY] Starting discovery (attempt ${retryCount + 1}/${maxRetries + 1})`);
    console.log(`[DEVICE DISCOVERY] Session token:`, session?.token?.access_token ? 'Present' : 'Missing');
    
    try {
      console.log(`[DEVICE DISCOVERY] Making request to /skill endpoint...`);
      
      const discoveryResponse = await client.post('/skill', {
        header: {
          payloadVersion: 1,
          namespace: 'discovery',
          name: 'Discovery'
        },
        payload: {
          accessToken: session.token.access_token
        }
      })
      
      console.log(`[DEVICE DISCOVERY] Raw response received:`, discoveryResponse.data);
      console.log(`[DEVICE DISCOVERY] Response status:`, discoveryResponse.status);
      console.log(`[DEVICE DISCOVERY] Response headers:`, discoveryResponse.headers);
      
      console.log(`[DEVICE DISCOVERY] Calling ensureSuccess...`);
      ensureSuccess(discoveryResponse)
      console.log(`[DEVICE DISCOVERY] ensureSuccess passed successfully`);

      const payload = discoveryResponse.data.payload
      console.log(`[DEVICE DISCOVERY] Payload extracted:`, payload);
      
      if (payload && payload.devices) {
        console.log(`[DEVICE DISCOVERY] Found ${payload.devices.length} devices in payload`);
        
        // fix payload data
        payload.devices = payload.devices
          .map(device => {
            console.log(`[DEVICE DISCOVERY] Processing device:`, device);
            
            // workaround json escaped signes
            try {
              device.name = JSON.parse(`"${device.name}"`)
              console.log(`[DEVICE DISCOVERY] Device name parsed:`, device.name);
            } catch (e) {
              console.log(`[DEVICE DISCOVERY] Failed to parse device name:`, device.name, e);
            }
          
            // workaround automation type
            if (device.dev_type === 'scene' && device.name.endsWith('#')) {
              device.dev_type = 'automation'
              device.name = device.name.replace(/\s*#$/, '')
              console.log(`[DEVICE DISCOVERY] Converted scene to automation:`, device.name);
            }

            const processedDevice = {
              id: device.id,
              name: device.name,
              type: device.dev_type,
              data: device.data,
              icon: device.icon
            }
            
            console.log(`[DEVICE DISCOVERY] Processed device:`, processedDevice);
            return processedDevice;
          })
          .filter(device => {
            const isAutomation = device.type === 'automation';
            console.log(`[DEVICE DISCOVERY] Device ${device.name} (${device.type}) - Automation: ${isAutomation}`);
            return !isAutomation;
          })
        
        console.log(`[DEVICE DISCOVERY] Final processed devices:`, payload.devices);
      } else {
        console.log(`[DEVICE DISCOVERY] No devices found in payload or payload is empty`);
        console.log(`[DEVICE DISCOVERY] Payload structure:`, JSON.stringify(payload, null, 2));
      }

      console.log(`[DEVICE DISCOVERY] Returning final response:`, discoveryResponse.data);
      return discoveryResponse.data
      
    } catch (error) {
      console.error(`[DEVICE DISCOVERY] Error occurred:`, error);
      console.error(`[DEVICE DISCOVERY] Error message:`, error.message);
      console.error(`[DEVICE DISCOVERY] Error stack:`, error.stack);
      
      // Retry logic for specific errors
      if (error.message.includes('temporarily unavailable') && retryCount < maxRetries) {
        console.log(`[DEVICE DISCOVERY] Service unavailable, retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        
        // Recursive retry
        return this.deviceDiscovery(retryCount + 1)
      }
      
      console.log(`[DEVICE DISCOVERY] No retry possible, throwing error`);
      // If max retries reached or other error, throw
      throw error
    }
  }

  // actions = ['turnOnOff', 'brightnessSet', 'colorSet', 'colorTemperatureSet']
  this.deviceControl = async (deviceId, action, fieldValue, fieldName) => {
    // for testing purpose only
    if (deviceId === 0) {
      return { header: { code: 'SUCCESS' } }
    }

    fieldName = fieldName || 'value'

    if (action === 'turnOnOff' &&
      fieldName === 'value' &&
      typeof fieldValue === 'boolean') {
      fieldValue = fieldValue ? 1 : 0
    }

    const controlResponse = await client.post('/skill', {
      header: {
        payloadVersion: 1,
        namespace: 'control',
        name: action
      },
      payload: {
        accessToken: session.token.access_token,
        devId: deviceId,
        [fieldName]: fieldValue
      }
    })
    console.debug('device control response', `${action}: ${fieldName}=${fieldValue}`, controlResponse.data)
    ensureSuccess(controlResponse)
  }
}

export default {
  HomeAssistantClient
}
