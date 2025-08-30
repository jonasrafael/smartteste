<template>
  <div id="nav">
    <el-form v-if="!loginState" :model="loginForm" :inline="true">
      <el-form-item label="Email address" size="medium">
        <el-input v-model="loginForm.username"></el-input>
      </el-form-item>
      <el-form-item label="Password">
        <el-input type="password" v-model="loginForm.password"></el-input>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="login()">Login</el-button>
      </el-form-item>
    </el-form>
    <template v-else>
      <el-button type="default" @click="refreshDevices()">Refresh</el-button>
      <el-button type="default" @click="refreshScenes()">Refresh Scenes</el-button>
      <el-button type="default" @click="logout()">Logout</el-button>
    </template>
  </div>

  <!-- Scenes Section -->
  <div v-if="scenes.length > 0" id="scenes">
    <h2>Cenas</h2>
    <div v-for="scene in scenes" :key="scene.id">
      <el-card class="scene-card">
        <el-tooltip effect="light" content="Scene" :offset="-20" :visible-arrow="false">
          <el-avatar :src="`/device_icons/scene.png`" shape="square">
            <img src="/device_icons/default.png"/>
          </el-avatar>
        </el-tooltip>
        <span class="device-name">{{ scene.name }}</span>
        <el-button type="default" circle size="large"
          class="trigger"
          @click="triggerScene(scene);"
        ><i class="material-icons-round">play_arrow</i></el-button>
      </el-card>
    </div>
  </div>

  <!-- Devices Section -->
  <div id="devices">
    <h2 v-if="scenes.length > 0">Dispositivos</h2>
    <div v-for="device in devicesSorted" :key="device.id">
      <el-card class="device" :style="device.data.online === false ? 'filter: opacity(0.65) grayscale(1);' : ''">
        <div class="device-header">
          <el-tooltip effect="light" :content="device.type" :offset="-20" :visible-arrow="false">
            <el-avatar :src="`/device_icons/${device.type}.png`" shape="square">
              <img src="/device_icons/default.png"/>
            </el-avatar>
          </el-tooltip>
          <span class="device-name">{{ device.name }}</span>
          <template v-if="device.type === 'scene'">
            <el-button type="default" circle size="large"
              class="trigger"
              @click="triggerScene(device);"
            ><i class="material-icons-round">play_arrow</i></el-button>
          </template>
          <template v-else>
            <el-button type="default" circle size="large"
              :class="device.data.state ? 'state-on' : 'state-off'"
              :disabled="!device.data.online"
              @click="toggleDevice(device);"
            ><i class="material-icons-round">{{ device.data.online ? 'power_settings_new' : 'cloud_off' }}</i></el-button>
          </template>
        </div>

        <!-- Enhanced Device Properties (Read-only) -->
        <div v-if="device.data.online && device.data.state && hasEnhancedProperties(device)" class="device-properties">
          
          <!-- Brightness/Dimmer -->
          <div v-if="device.brightness" class="property-row">
            <span class="property-label">
              <i class="material-icons-round">brightness_6</i>
              Brilho:
            </span>
            <span class="property-value">{{ device.brightness.value }}%</span>
            <el-progress 
              :percentage="device.brightness.value" 
              :show-text="false" 
              :stroke-width="8"
              class="brightness-bar"
            />
          </div>

          <!-- Color Information -->
          <div v-if="device.color && device.color.parsed" class="property-row">
            <span class="property-label">
              <i class="material-icons-round">palette</i>
              Cor:
            </span>
            <div class="color-info">
              <div class="color-preview" :style="getColorStyle(device.color.parsed)"></div>
              <span class="color-values">
                H: {{ device.color.parsed.hue }}°, 
                S: {{ device.color.parsed.saturation }}%, 
                V: {{ device.color.parsed.value }}%
              </span>
            </div>
          </div>

          <!-- Color Temperature -->
          <div v-if="device.colorTemperature" class="property-row">
            <span class="property-label">
              <i class="material-icons-round">wb_incandescent</i>
              Temperatura:
            </span>
            <span class="property-value">{{ device.colorTemperature.value }}K</span>
          </div>

          <!-- Work Mode -->
          <div v-if="device.workMode" class="property-row">
            <span class="property-label">
              <i class="material-icons-round">settings</i>
              Modo:
            </span>
            <span class="property-value">{{ formatWorkMode(device.workMode.value) }}</span>
          </div>

          <!-- Raw Data (for debugging) -->
          <div v-if="showDebugInfo" class="property-row debug-info">
            <span class="property-label">
              <i class="material-icons-round">bug_report</i>
              Debug:
            </span>
            <pre class="debug-data">{{ JSON.stringify(device.data, null, 2) }}</pre>
          </div>
        </div>
      </el-card>
    </div>
  </div>

  <!-- Debug Toggle -->
  <div class="debug-toggle">
    <el-button size="small" @click="showDebugInfo = !showDebugInfo">
      {{ showDebugInfo ? 'Ocultar' : 'Mostrar' }} Debug Info
    </el-button>
  </div>
</template>

<script>
export default {
  name: 'HomeEnhanced'
}
</script>

<script setup>
/* eslint-disable no-unused-vars */
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from "element-plus"

import tuyaEnhanced from '@/libs/tuya-enhanced'

const homeAssistantClient = new tuyaEnhanced.HomeAssistantClient(
  JSON.parse(localStorage.getItem('session'))
)

const loginState = ref(false)
const devices = ref([])
const scenes = ref([])
const showDebugInfo = ref(false)

const devicesSorted = computed(() => {
  const order = { true: 0, undefined: 1, false: 2 }
  return devices.value.slice().sort((d1, d2) =>
    order[d1.data.online] > order[d2.data.online] ? 1 : -1
  )
})

const loginForm = ref({ username: '', password: '' })

onMounted(async () => {
  // TODO handle expired session
  loginState.value = !!homeAssistantClient.getSession()
  if (!loginState.value) {
    localStorage.clear()
  }
  devices.value = JSON.parse(localStorage.getItem('devices')) || []
  scenes.value = JSON.parse(localStorage.getItem('scenes')) || []
})

const login = async () => {
  try {
    await homeAssistantClient.login(
      loginForm.value.username,
      loginForm.value.password
    )
    localStorage.setItem('session', JSON.stringify(homeAssistantClient.getSession()))
    loginState.value = true
    loginForm.value = { username: '', password: '' }
    refreshDevices()
    refreshScenes()
  } catch (err) {
    ElMessage.error(`Oops, login error. (${err})`)
  }
}

const logout = () => {
  homeAssistantClient.dropSession()
  localStorage.clear()
  loginState.value = false
  loginForm.value = { username: '', password: '' }
  devices.value = []
  scenes.value = []
}

const refreshDevices = async () => {
  // TODO handle expired session
  try {
    const discoveryResponse = await homeAssistantClient.deviceDiscovery()
    const discoveryDevices = discoveryResponse.payload.devices || []
    devices.value = discoveryDevices
    localStorage.setItem('devices', JSON.stringify(discoveryDevices))
    ElMessage.success('Dispositivos atualizados com sucesso!')
  } catch (err) {
    ElMessage.error(`Oops, device discovery error. (${err})`)
  }
}

const refreshScenes = async () => {
  try {
    const scenesList = await homeAssistantClient.getScenes()
    scenes.value = scenesList
    localStorage.setItem('scenes', JSON.stringify(scenesList))
    ElMessage.success('Cenas atualizadas com sucesso!')
  } catch (err) {
    ElMessage.error(`Erro ao buscar cenas. (${err})`)
  }
}

const toggleDevice = async (device) => {
  // TODO handle expired session
  // TODO change icon to el-icon-loading
  try {
    const newState = !device.data.state
    await homeAssistantClient.deviceControl(device.id, 'turnOnOff', newState)
    device.data.state = newState
  } catch (err) {
    ElMessage.error(`Oops, device control error. (${err})`)
  }
}

const triggerScene = async (scene) => {
  // TODO handle expired session
  // TODO change icon to el-icon-loading
  try {
    await homeAssistantClient.triggerScene(scene.id)
    ElMessage.success(`Cena "${scene.name}" ativada!`)
  } catch (err) {
    ElMessage.error(`Erro ao ativar cena. (${err})`)
  }
}

const hasEnhancedProperties = (device) => {
  return device.brightness || device.color || device.colorTemperature || device.workMode
}

const getColorStyle = (colorData) => {
  if (!colorData) return {}
  
  // Convert HSV to HSL for CSS
  const h = colorData.hue
  const s = colorData.saturation
  const v = colorData.value
  
  // HSV to HSL conversion
  const l = v * (2 - s / 100) / 2
  const sl = l !== 0 && l !== 100 ? (v - l) / Math.min(l, 100 - l) * 100 : 0
  
  return {
    backgroundColor: `hsl(${h}, ${sl}%, ${l}%)`,
    border: '1px solid #ccc'
  }
}

const formatWorkMode = (mode) => {
  const modeMap = {
    'white': 'Branco',
    'colour': 'Colorido',
    'color': 'Colorido',
    'scene': 'Cena',
    'music': 'Música',
    'scene_1': 'Cena 1',
    'scene_2': 'Cena 2',
    'scene_3': 'Cena 3',
    'scene_4': 'Cena 4'
  }
  
  return modeMap[mode] || mode
}
</script>

<style scoped>
#nav {
  margin: 0 auto;
  margin-top: 64px;
  margin-bottom: 64px;
}

h2 {
  text-align: center;
  margin: 32px 0 16px 0;
  color: #409eff;
}

.el-card.device, .el-card.scene-card {
  max-width: 800px;
  margin: 0 auto;
  margin-bottom: 16px;
}

.device-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.device-header :last-child {
  margin-left: auto;
}

.device-properties {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.property-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.property-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: #606266;
  min-width: 120px;
}

.property-value {
  font-weight: 600;
  color: #409eff;
}

.brightness-bar {
  flex: 1;
  max-width: 200px;
}

.color-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: inline-block;
}

.color-values {
  font-size: 12px;
  color: #909399;
}

.debug-info {
  flex-direction: column;
  align-items: flex-start;
}

.debug-data {
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  max-height: 200px;
  overflow-y: auto;
  width: 100%;
  margin-top: 8px;
}

.debug-toggle {
  text-align: center;
  margin: 32px 0;
}

.el-button.state-on:enabled {
  color: #f9f9f9;
  background-color: #7dd8ba;
}

.el-button.state-off:enabled {
  color: #a3a4a7;
  background-color: #f9f9f9;
}

.el-button.trigger:enabled {
  color: #f9f9f9;
  background-color: #9eabce;
}

.el-button.el-button--large {
  padding: 9px;
  font-size: 20px;
  line-height: 0px;
}

.el-avatar {
  background: transparent;
  margin-right: 16px;
}

.device-name {
  font-weight: 500;
  color: #303133;
}

/* Material Icons */
.material-icons-round {
  font-family: 'Material Icons Round';
  font-weight: normal;
  font-style: normal;
  font-size: 18px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}
</style>

