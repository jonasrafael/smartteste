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
    
    try {
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
      console.debug('device discovery response', discoveryResponse.data)
      ensureSuccess(discoveryResponse)

      const payload = discoveryResponse.data.payload
      if (payload && payload.devices) {
        // fix payload data
        payload.devices = payload.devices
          .map(device => {
            // workaround json escaped signes
            device.name = JSON.parse(`"${device.name}"`)
          
            // workaround automation type
            if (device.dev_type === 'scene' && device.name.endsWith('#')) {
              device.dev_type = 'automation'
              device.name = device.name.replace(/\s*#$/, '')
            }

            return {
              id: device.id,
              name: device.name,
              type: device.dev_type,
              data: device.data,
              icon: device.icon
            }
          })
          .filter(device => device.type !== 'automation')
      }

      return discoveryResponse.data
      
    } catch (error) {
      // Retry logic for specific errors
      if (error.message.includes('temporarily unavailable') && retryCount < maxRetries) {
        console.log(`Device discovery failed, retrying in ${retryDelay/1000}s... (attempt ${retryCount + 1}/${maxRetries})`)
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        
        // Recursive retry
        return this.deviceDiscovery(retryCount + 1)
      }
      
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
