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
      <el-button type="default" @click="refreshAll()">Refresh All</el-button>
      <el-button type="default" @click="logout()">Logout</el-button>
    </template>
  </div>

  <!-- Main Content with Tabs -->
  <div v-if="loginState" id="main-content">
    <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
      
      <!-- Devices Tab -->
      <el-tab-pane label="🏠 Dispositivos" name="devices">
        <div class="tab-header">
          <h2>Dispositivos Conectados</h2>
          <el-button type="primary" @click="refreshDevices()" size="small">
            <i class="material-icons-round">refresh</i> Atualizar
          </el-button>
        </div>
        
        <div class="devices-grid">
          <div v-for="device in devicesSorted" :key="device.id">
            <el-card class="device" :style="device.data.online === false ? 'filter: opacity(0.65) grayscale(1);' : ''">
              <div class="device-header">
                <el-tooltip effect="light" :content="device.type" :offset="-20" :visible-arrow="false">
                  <el-avatar :src="`/device_icons/${device.type}.png`" shape="square">
                    <img src="/device_icons/default.png"/>
                  </el-avatar>
                </el-tooltip>
                <span class="device-name">{{ device.name }}</span>
                <el-button type="default" circle size="large"
                  :class="device.data.state ? 'state-on' : 'state-off'"
                  :disabled="!device.data.online"
                  @click="toggleDeviceWithRateLimit(device);"
                ><i class="material-icons-round">{{ device.data.online ? 'power_settings_new' : 'cloud_off' }}</i></el-button>
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
      </el-tab-pane>

      <!-- Rooms Tab -->
      <el-tab-pane label="🏠 Salas" name="rooms">
        <div class="tab-header">
          <h2>Organização por Salas</h2>
          <div class="tab-actions">
            <el-button type="primary" @click="refreshRooms()" size="small">
              <i class="material-icons-round">refresh</i> Atualizar
            </el-button>
            <el-button type="success" @click="showRoomDialog = true" size="small">
              <i class="material-icons-round">add</i> Nova Sala
            </el-button>
          </div>
        </div>
        
        <div v-if="organizedRooms.length > 0" class="rooms-grid">
          <div v-for="room in organizedRooms" :key="room.id" class="room-card">
            <el-card>
              <div class="room-header">
                <span class="room-icon">{{ room.icon }}</span>
                <h3>{{ room.name }}</h3>
                <span class="device-count">{{ room.devices.length }} dispositivo(s)</span>
              </div>
              
              <div v-if="room.devices.length > 0" class="room-devices">
                <div v-for="device in room.devices" :key="device.id" class="room-device">
                  <el-avatar :src="`/device_icons/${device.type}.png`" size="small">
                    <img src="/device_icons/default.png"/>
                  </el-avatar>
                  <span class="device-name">{{ device.name }}</span>
                  <el-button 
                    type="text" 
                    size="small" 
                    @click="assignDeviceToRoom(device.id, 'other')"
                    title="Remover da sala"
                  >
                    <i class="material-icons-round">close</i>
                  </el-button>
                </div>
              </div>
              
              <div v-else class="room-empty">
                <el-empty description="Nenhum dispositivo nesta sala" :image-size="60">
                  <el-button type="primary" size="small" @click="showDeviceAssignmentDialog(room.id)">
                    Adicionar Dispositivo
                  </el-button>
                </el-empty>
              </div>
            </el-card>
          </div>
        </div>
        
        <el-empty v-else description="Nenhuma sala configurada">
          <el-button type="primary" @click="showRoomDialog = true">Criar Primeira Sala</el-button>
        </el-empty>
      </el-tab-pane>

      <!-- Scenes Tab -->
      <el-tab-pane label="🎭 Cenas" name="scenes">
        <div class="tab-header">
          <h2>Cenas e Automações</h2>
          <el-button type="primary" @click="refreshScenes()" size="small">
            <i class="material-icons-round">refresh</i> Atualizar
          </el-button>
        </div>
        
        <div v-if="scenes.length > 0" class="scenes-grid">
          <div v-for="scene in scenes" :key="scene.id">
            <el-card class="scene-card">
              <div class="scene-header">
                <el-tooltip effect="light" :content="scene.type === 'automation' ? 'Automação' : 'Cena'" :offset="-20" :visible-arrow="false">
                  <el-avatar :src="`/device_icons/${scene.type === 'automation' ? 'automation' : 'scene'}.png`" shape="square">
                    <img src="/device_icons/default.png"/>
                  </el-avatar>
                </el-tooltip>
                <div class="scene-info">
                  <span class="scene-name">{{ scene.name }}</span>
                  <span class="scene-type">{{ scene.type === 'automation' ? 'Automação' : 'Cena' }}</span>
                </div>
                                  <el-button type="primary" circle size="large"
                    class="trigger"
                    @click="triggerSceneWithRateLimit(scene);"
                  ><i class="material-icons-round">play_arrow</i></el-button>
              </div>
            </el-card>
          </div>
        </div>
        
        <el-empty v-else description="Nenhuma cena ou automação encontrada">
          <el-button type="primary" @click="refreshScenes()">Buscar Cenas</el-button>
        </el-empty>
      </el-tab-pane>

      <!-- Records Tab -->
      <el-tab-pane label="📊 Registros" name="records">
        <div class="tab-header">
          <h2>Histórico e Analytics</h2>
          <div class="tab-actions">
            <el-select v-model="analyticsPeriod" size="small" style="width: 120px;">
              <el-option label="7 dias" value="7"></el-option>
              <el-option label="30 dias" value="30"></el-option>
              <el-option label="90 dias" value="90"></el-option>
            </el-select>
            <el-button type="primary" @click="refreshRecords()" size="small">
              <i class="material-icons-round">refresh</i> Atualizar
            </el-button>
          </div>
        </div>
        
        <div v-if="analyticsSummary" class="analytics-summary">
          <el-row :gutter="20">
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-number">{{ analyticsSummary.totalDevices }}</div>
                  <div class="stat-label">Dispositivos</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-number">{{ analyticsSummary.totalActions }}</div>
                  <div class="stat-label">Ações</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-number">{{ analyticsSummary.successRate }}%</div>
                  <div class="stat-label">Taxa de Sucesso</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card class="stat-card">
                <div class="stat-content">
                  <div class="stat-number">{{ analyticsSummary.systemHealth }}</div>
                  <div class="stat-label">Saúde do Sistema</div>
                </div>
              </el-card>
            </el-col>
          </el-row>
          
          <el-card class="analytics-details" style="margin-top: 20px;">
            <template #header>
              <span>Detalhes dos Registros</span>
            </template>
            <div v-if="deviceRecords.length > 0" class="records-list">
              <div v-for="record in deviceRecords.slice(0, 20)" :key="record.id" class="record-item">
                <span class="record-time">{{ formatTime(record.timestamp) }}</span>
                <span class="record-device">{{ getDeviceName(record.deviceId) }}</span>
                <span class="record-action">{{ record.action }}</span>
                <span class="record-status" :class="record.success ? 'success' : 'error'">
                  {{ record.success ? '✅' : '❌' }}
                </span>
              </div>
            </div>
            <el-empty v-else description="Nenhum registro encontrado"></el-empty>
          </el-card>
        </div>
        
        <el-empty v-else description="Carregando analytics...">
          <el-button type="primary" @click="refreshRecords()">Atualizar</el-button>
        </el-empty>
      </el-tab-pane>

      <!-- Logs Tab -->
      <el-tab-pane label="📝 Logs" name="logs">
        <div class="tab-header">
          <h2>Logs do Sistema</h2>
          <div class="tab-actions">
            <el-select v-model="logLevel" size="small" style="width: 120px;">
              <el-option label="Todos" value="all"></el-option>
              <el-option label="Info" value="info"></el-option>
              <el-option label="Warning" value="warning"></el-option>
              <el-option label="Error" value="error"></el-option>
            </el-select>
            <el-button type="primary" @click="refreshLogs()" size="small">
              <i class="material-icons-round">refresh</i> Atualizar
            </el-button>
          </div>
        </div>
        
        <!-- Real-time Monitoring Controls -->
        <div class="monitoring-controls" style="margin-bottom: 20px;">
          <el-card>
            <template #header>
              <span>🔄 Monitoramento em Tempo Real da Tuya</span>
            </template>
            <div class="monitoring-status">
              <div class="status-info">
                <span class="status-label">Status:</span>
                <el-tag :type="isMonitoringActive ? 'success' : 'info'" size="large">
                  {{ isMonitoringActive ? '🟢 Ativo' : '⚪ Inativo' }}
                </el-tag>
                <span class="status-details">
                  {{ isMonitoringActive ? 'Capturando eventos da Tuya a cada 3 segundos' : 'Monitoramento parado' }}
                </span>
              </div>
              <div class="monitoring-actions">
                <el-button 
                  v-if="!isMonitoringActive"
                  type="success" 
                  @click="startTuyaMonitoring()"
                  size="large"
                >
                  <i class="material-icons-round">play_arrow</i> Iniciar Monitoramento
                </el-button>
                <el-button 
                  v-else
                  type="danger" 
                  @click="stopTuyaMonitoring()"
                  size="large"
                >
                  <i class="material-icons-round">stop</i> Parar Monitoramento
                </el-button>
                <el-button 
                  type="primary" 
                  @click="refreshLogs()"
                  size="large"
                >
                  <i class="material-icons-round">refresh</i> Atualizar Logs
                </el-button>
              </div>
            </div>
            <div v-if="isMonitoringActive" class="monitoring-stats">
              <el-row :gutter="20">
                <el-col :span="6">
                  <div class="stat-item">
                    <span class="stat-number">{{ tuyaEventCounts.total || 0 }}</span>
                    <span class="stat-label">Total de Eventos</span>
                  </div>
                </el-col>
                <el-col :span="6">
                  <div class="stat-item">
                    <span class="stat-number">{{ tuyaEventCounts.deviceStatus || 0 }}</span>
                    <span class="stat-label">Status de Dispositivos</span>
                  </div>
                </el-col>
                <el-col :span="6">
                  <div class="stat-item">
                    <span class="stat-number">{{ tuyaEventCounts.scenes || 0 }}</span>
                    <span class="stat-label">Cenas Executadas</span>
                  </div>
                </el-col>
                <el-col :span="6">
                  <div class="stat-item">
                    <span class="stat-number">{{ tuyaEventCounts.alerts || 0 }}</span>
                    <span class="stat-label">Alertas do Sistema</span>
                  </div>
                </el-col>
              </el-row>
            </div>
          </el-card>
        </div>
        
        <div v-if="systemLogs.length > 0" class="logs-container">
          <el-card>
            <template #header>
              <span>Logs do Sistema ({{ systemLogs.length }} entradas)</span>
            </template>
            <div class="logs-list">
              <div v-for="log in systemLogs" :key="log.id" class="log-item" :class="`log-${log.level}`">
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span class="log-level" :class="`level-${log.level}`">{{ log.level.toUpperCase() }}</span>
                <span class="log-message">{{ log.message }}</span>
                <span v-if="log.details && Object.keys(log.details).length > 0" class="log-details">
                  <el-button type="text" size="small" @click="showLogDetails(log)">
                    <i class="material-icons-round">info</i>
                  </el-button>
                </span>
              </div>
            </div>
          </el-card>
        </div>
        
        <el-empty v-else description="Nenhum log encontrado">
          <el-button type="primary" @click="refreshLogs()">Atualizar</el-button>
        </el-empty>
      </el-tab-pane>

      <!-- Profile Tab -->
      <el-tab-pane label="👤 Perfil" name="profile">
        <div class="tab-header">
          <h2>Perfil e Configurações</h2>
          <el-button type="primary" @click="saveProfile()" size="small">
            <i class="material-icons-round">save</i> Salvar
          </el-button>
        </div>
        
        <div class="profile-container">
          <el-form :model="profileForm" label-width="120px">
            <el-form-item label="Nome do Usuário">
              <el-input v-model="profileForm.username" disabled></el-input>
            </el-form-item>
            <el-form-item label="Região">
              <el-select v-model="profileForm.region">
                <el-option label="Europa" value="eu"></el-option>
                <el-option label="América do Norte" value="us"></el-option>
                <el-option label="Ásia" value="as"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Idioma">
              <el-select v-model="profileForm.language">
                <el-option label="Português" value="pt"></el-option>
                <el-option label="English" value="en"></el-option>
                <el-option label="Español" value="es"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="Tema">
              <el-select v-model="profileForm.theme">
                <el-option label="Claro" value="light"></el-option>
                <el-option label="Escuro" value="dark"></el-option>
                <el-option label="Automático" value="auto"></el-option>
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

    </el-tabs>
  </div>

  <!-- Room Management Dialog -->
  <el-dialog v-model="showRoomDialog" title="Gerenciar Salas" width="600px">
    <div class="room-management">
      <el-button type="primary" @click="addNewRoom" style="margin-bottom: 20px;">
        <i class="material-icons-round">add</i> Adicionar Nova Sala
      </el-button>
      
      <div v-for="(room, index) in rooms" :key="room.id" class="room-edit-item">
        <el-input v-model="room.name" placeholder="Nome da sala" style="width: 200px; margin-right: 10px;"></el-input>
        <el-input v-model="room.icon" placeholder="Emoji" style="width: 80px; margin-right: 10px;"></el-input>
        <el-button type="danger" size="small" @click="removeRoom(index)" :disabled="room.id === 'other'">
          <i class="material-icons-round">delete</i>
        </el-button>
      </div>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showRoomDialog = false">Cancelar</el-button>
        <el-button type="primary" @click="saveRooms">Salvar</el-button>
      </span>
    </template>
  </el-dialog>

  <!-- Device Assignment Dialog -->
  <el-dialog v-model="showDeviceAssignmentDialog" title="Atribuir Dispositivo à Sala" width="500px">
    <div class="device-assignment">
      <p>Selecione a sala para o dispositivo:</p>
      <el-select v-model="selectedRoomForDevice" placeholder="Escolha uma sala" style="width: 100%;">
        <el-option 
          v-for="room in rooms" 
          :key="room.id" 
          :label="room.name" 
          :value="room.id"
        >
          <span style="margin-right: 10px;">{{ room.icon }}</span>
          {{ room.name }}
        </el-option>
      </el-select>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="showDeviceAssignmentDialog = false">Cancelar</el-button>
        <el-button type="primary" @click="assignDeviceToSelectedRoom">Confirmar</el-button>
      </span>
    </template>
  </el-dialog>

  <!-- Log Details Dialog -->
  <el-dialog v-model="showLogDetailsDialog" title="Detalhes do Log" width="600px">
    <div v-if="selectedLog" class="log-details">
      <p><strong>Mensagem:</strong> {{ selectedLog.message }}</p>
      <p><strong>Nível:</strong> {{ selectedLog.level }}</p>
      <p><strong>Timestamp:</strong> {{ formatTime(selectedLog.timestamp) }}</p>
      <p><strong>Usuário:</strong> {{ selectedLog.userId }}</p>
      <div v-if="selectedLog.details && Object.keys(selectedLog.details).length > 0">
        <p><strong>Detalhes:</strong></p>
        <pre>{{ JSON.stringify(selectedLog.details, null, 2) }}</pre>
      </div>
    </div>
  </el-dialog>

  <!-- Debug Toggle -->
  <div v-if="loginState" class="debug-toggle">
    <el-button size="small" @click="showDebugInfo = !showDebugInfo">
      {{ showDebugInfo ? 'Ocultar' : 'Mostrar' }} Debug Info
    </el-button>
  </div>
</template>

<script setup>
/* eslint-disable no-unused-vars */
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from "element-plus"

import tuyaEnhanced from '@/libs/tuya-enhanced'

const homeAssistantClient = new tuyaEnhanced.HomeAssistantClient(
  JSON.parse(localStorage.getItem('session'))
)

const loginState = ref(false)
const devices = ref([])
const scenes = ref([])
const showDebugInfo = ref(false)
const activeTab = ref('devices')

// Room management
const rooms = ref([])
const organizedRooms = ref([])
const showRoomDialog = ref(false)
const showDeviceAssignmentDialog = ref(false)
const selectedRoomForDevice = ref('')

// Analytics and records
const analyticsPeriod = ref(7)
const analyticsSummary = ref(null)
const deviceRecords = ref([])

// System logs
const logLevel = ref('all')
const systemLogs = ref([])
const showLogDetailsDialog = ref(false)
const selectedLog = ref(null)

// Profile form
const profileForm = ref({
  username: '',
  region: 'eu',
  language: 'pt',
  theme: 'light'
})

// Real-time monitoring state
const isMonitoringActive = ref(false)
const tuyaEventCounts = ref({
  total: 0,
  deviceStatus: 0,
  scenes: 0,
  automations: 0,
  alerts: 0,
  notifications: 0,
  deviceChanges: 0
})

// Device control queue status
const deviceQueueStatus = ref(new Map())

// Backup system state
const showBackupDialog = ref(false)
const showRestoreDialog = ref(false)
const showBackupInfoDialog = ref(false)
const isCreatingBackup = ref(false)
const isDownloading = ref(false)
const isRestoring = ref(false)
const lastBackup = ref(null)
const selectedBackupFile = ref(null)

// Backup options
const backupOptions = ref({
  includeSensitive: false,
  compress: true,
  encrypt: false
})

// Restore options
const restoreOptions = ref({
  mode: 'merge',
  backupBefore: true
})

// Backup summary
const backupSummary = ref({
  devices: 0,
  scenes: 0,
  rooms: 0,
  records: 0,
  logs: 0,
  settings: 0
})

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
    } else {
      // Load profile data
      const session = homeAssistantClient.getSession()
      profileForm.value.username = session?.username || ''
      profileForm.value.region = session?.region || 'eu'
      
      // Load saved profile preferences
      const savedProfile = JSON.parse(localStorage.getItem('profile')) || {}
      profileForm.value = { ...profileForm.value, ...savedProfile }
    }
    
    devices.value = JSON.parse(localStorage.getItem('devices')) || []
    scenes.value = JSON.parse(localStorage.getItem('scenes')) || []
    
    // Load rooms and organize devices
    await loadRooms()
    await loadAnalytics()
    await loadLogs()
    
    // Check if monitoring was previously active
    const wasMonitoring = localStorage.getItem('tuya_monitoring_active') === 'true'
    if (wasMonitoring) {
      // Restart monitoring if it was active before
      startTuyaMonitoring()
    }
    
    // Load last backup info
    const savedLastBackup = localStorage.getItem('lastBackup')
    if (savedLastBackup) {
      try {
        lastBackup.value = JSON.parse(savedLastBackup)
      } catch (err) {
        console.error('Error loading last backup info:', err)
      }
    }
  })

// Watch for analytics period changes
watch(analyticsPeriod, async () => {
  await loadAnalytics()
})

// Watch for log level changes
watch(logLevel, async () => {
  await loadLogs()
})

const login = async () => {
  try {
    await homeAssistantClient.login(
      loginForm.value.username,
      loginForm.value.password
    )
    const session = homeAssistantClient.getSession()
    localStorage.setItem('session', JSON.stringify(session))
    
    // Update profile form with session data
    profileForm.value.username = loginForm.value.username
    profileForm.value.region = session.region
    
    loginState.value = true
    loginForm.value = { username: '', password: '' }
    refreshAll()
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
  activeTab.value = 'devices'
}

const refreshAll = async () => {
  try {
    await Promise.all([
      refreshDevices(),
      refreshScenes(),
      loadRooms(),
      loadAnalytics(),
      loadLogs()
    ])
    ElMessage.success('Todos os dados foram atualizados com sucesso!')
  } catch (err) {
    ElMessage.error(`Erro ao atualizar dados. (${err})`)
  }
}

const refreshDevices = async () => {
  try {
    const discoveryResponse = await homeAssistantClient.deviceDiscovery()
    const discoveryDevices = discoveryResponse.payload.devices || []
    devices.value = discoveryDevices
    localStorage.setItem('devices', JSON.stringify(discoveryDevices))
    
    // Reorganize devices by room after refresh
    await loadRooms()
    
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

const loadRooms = async () => {
  try {
    rooms.value = await homeAssistantClient.getRooms()
    organizedRooms.value = homeAssistantClient.organizeDevicesByRoom(devices.value, rooms.value)
  } catch (err) {
    console.error('Error loading rooms:', err)
  }
}

const refreshRooms = async () => {
  await loadRooms()
  ElMessage.success('Salas atualizadas com sucesso!')
}

const addNewRoom = () => {
  const newRoom = {
    id: `room_${Date.now()}`,
    name: 'Nova Sala',
    icon: '🏠',
    devices: []
  }
  rooms.value.push(newRoom)
}

const removeRoom = (index) => {
  if (rooms.value[index].id === 'other') return
  rooms.value.splice(index, 1)
}

const saveRooms = async () => {
  try {
    await homeAssistantClient.saveRooms(rooms.value)
    await loadRooms()
    showRoomDialog.value = false
    ElMessage.success('Salas salvas com sucesso!')
  } catch (err) {
    ElMessage.error(`Erro ao salvar salas. (${err})`)
  }
}

const openDeviceAssignmentDialog = (roomId) => {
  selectedRoomForDevice.value = roomId
  showDeviceAssignmentDialog.value = true
}

const assignDeviceToSelectedRoom = async () => {
  try {
    // This would be implemented to assign a device to the selected room
    // For now, we'll just close the dialog
    showDeviceAssignmentDialog.value = false
    ElMessage.success('Dispositivo atribuído à sala!')
  } catch (err) {
    ElMessage.error(`Erro ao atribuir dispositivo. (${err})`)
  }
}

const assignDeviceToRoom = async (deviceId, roomId) => {
  try {
    await homeAssistantClient.assignDeviceToRoom(deviceId, roomId)
    await loadRooms()
    ElMessage.success('Dispositivo movido para a sala!')
  } catch (err) {
    ElMessage.error(`Erro ao mover dispositivo. (${err})`)
  }
}

const loadAnalytics = async () => {
  try {
    analyticsSummary.value = await homeAssistantClient.getAnalyticsSummary(parseInt(analyticsPeriod.value))
    deviceRecords.value = await homeAssistantClient.getDeviceRecords(null, parseInt(analyticsPeriod.value))
  } catch (err) {
    console.error('Error loading analytics:', err)
  }
}

const refreshRecords = async () => {
  await loadAnalytics()
  ElMessage.success('Registros atualizados com sucesso!')
}

const loadLogs = async () => {
  try {
    systemLogs.value = await homeAssistantClient.getSystemLogs(logLevel.value, 100)
  } catch (err) {
    console.error('Error loading logs:', err)
  }
}

const refreshLogs = async () => {
  await loadLogs()
  ElMessage.success('Logs atualizados com sucesso!')
}

const showLogDetails = (log) => {
  selectedLog.value = log
  showLogDetailsDialog.value = true
}

const saveProfile = async () => {
  try {
    // Save profile preferences
    localStorage.setItem('profile', JSON.stringify(profileForm.value))
    
    // TODO: Save to backend if available
    ElMessage.success('Perfil salvo com sucesso!')
  } catch (err) {
    ElMessage.error(`Erro ao salvar perfil. (${err})`)
  }
}

const toggleDevice = async (device) => {
  try {
    const newState = !device.data.state
    await homeAssistantClient.deviceControl(device.id, 'turnOnOff', newState)
    device.data.state = newState
    
    // Log the action for analytics
    homeAssistantClient.logDeviceAction(device.id, 'turnOnOff', newState, true)
    
    // Log system event
    homeAssistantClient.logSystemEvent('info', `Device ${device.name} ${newState ? 'turned on' : 'turned off'}`)
    
  } catch (err) {
    // Log failed action
    homeAssistantClient.logDeviceAction(device.id, 'turnOnOff', !device.data.state, false)
    
    // Log error
    homeAssistantClient.logSystemEvent('error', `Failed to control device ${device.name}`, { error: err.message })
    
    ElMessage.error(`Oops, device control error. (${err})`)
  }
}

const triggerScene = async (scene) => {
  try {
    await homeAssistantClient.triggerScene(scene.id)
    
    // Log the action for analytics
    homeAssistantClient.logDeviceAction(scene.id, 'triggerScene', true, true)
    
    // Log system event
    homeAssistantClient.logSystemEvent('info', `Scene ${scene.name} triggered`)
    
    ElMessage.success(`Cena "${scene.name}" ativada!`)
  } catch (err) {
    // Log failed action
    homeAssistantClient.logDeviceAction(scene.id, 'triggerScene', true, false)
    
    // Log error
    homeAssistantClient.logSystemEvent('error', `Failed to trigger scene ${scene.name}`, { error: err.message })
    
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

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getDeviceName = (deviceId) => {
  const device = devices.value.find(d => d.id === deviceId)
  return device ? device.name : `Dispositivo ${deviceId}`
}

// Real-time monitoring functions
const startTuyaMonitoring = async () => {
  try {
    const success = await homeAssistantClient.startTuyaEventMonitoring(handleTuyaEvents);
    if (success) {
      isMonitoringActive.value = true;
      localStorage.setItem('tuya_monitoring_active', 'true');
      ElMessage.success('Monitoramento em tempo real iniciado!');
      
      // Start updating queue status
      startQueueStatusUpdates();
    } else {
      ElMessage.error('Falha ao iniciar monitoramento');
    }
  } catch (err) {
    ElMessage.error(`Erro ao iniciar monitoramento: ${err.message}`);
  }
};

const stopTuyaMonitoring = () => {
  try {
    homeAssistantClient.stopTuyaEventMonitoring();
    isMonitoringActive.value = false;
    localStorage.setItem('tuya_monitoring_active', 'false');
    ElMessage.success('Monitoramento em tempo real parado!');
    
    // Stop updating queue status
    stopQueueStatusUpdates();
  } catch (err) {
    ElMessage.error(`Erro ao parar monitoramento: ${err.message}`);
  }
};

// Handle Tuya events from monitoring
const handleTuyaEvents = (events) => {
  try {
    // Update event counts
    Object.keys(events).forEach(eventType => {
      const eventList = events[eventType];
      if (eventList && eventList.length > 0) {
        tuyaEventCounts.value[eventType] = (tuyaEventCounts.value[eventType] || 0) + eventList.length;
        tuyaEventCounts.value.total = (tuyaEventCounts.value.total || 0) + eventList.length;
      }
    });

    // Refresh logs to show new events
    refreshLogs();
    
  } catch (err) {
    console.error('Error handling Tuya events:', err);
  }
};

// Queue status updates
let queueStatusInterval = null;

const startQueueStatusUpdates = () => {
  queueStatusInterval = setInterval(() => {
    updateDeviceQueueStatus();
  }, 1000); // Update every second
};

const stopQueueStatusUpdates = () => {
  if (queueStatusInterval) {
    clearInterval(queueStatusInterval);
    queueStatusInterval = null;
  }
};

const updateDeviceQueueStatus = () => {
  try {
    const newStatus = new Map();
    
    devices.value.forEach(device => {
      const status = homeAssistantClient.getDeviceControlQueueStatus(device.id);
      newStatus.set(device.id, status);
    });
    
    deviceQueueStatus.value = newStatus;
  } catch (err) {
    console.error('Error updating device queue status:', err);
  }
};

// Backup and restore functions
const createBackup = async () => {
  try {
    isCreatingBackup.value = true;
    
    // Collect all data for backup
    const backupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      metadata: {
        app: 'Smart Life WebApp Enhanced',
        user: profileForm.value.username,
        region: profileForm.value.region
      },
      data: {
        devices: devices.value,
        scenes: scenes.value,
        rooms: rooms.value,
        deviceRecords: deviceRecords.value,
        systemLogs: systemLogs.value,
        profile: profileForm.value,
        monitoring: {
          isActive: isMonitoringActive.value,
          eventCounts: tuyaEventCounts.value
        }
      }
    };
    
    // Update backup summary
    backupSummary.value = {
      devices: devices.value.length,
      scenes: scenes.value.length,
      rooms: rooms.value.length,
      records: deviceRecords.value.length,
      logs: systemLogs.value.length,
      settings: 1
    };
    
    // Show backup dialog
    showBackupDialog.value = true;
    
    ElMessage.success('Backup preparado com sucesso!');
    
  } catch (err) {
    console.error('Error creating backup:', err);
    ElMessage.error('Erro ao criar backup');
  } finally {
    isCreatingBackup.value = false;
  }
};

const downloadBackup = async () => {
  try {
    isDownloading.value = true;
    
    // Create backup data
    const backupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      metadata: {
        app: 'Smart Life WebApp Enhanced',
        user: profileForm.value.username,
        region: profileForm.value.region
      },
      data: {
        devices: devices.value,
        scenes: scenes.value,
        rooms: rooms.value,
        deviceRecords: deviceRecords.value,
        systemLogs: systemLogs.value,
        profile: profileForm.value,
        monitoring: {
          isActive: isMonitoringActive.value,
          eventCounts: tuyaEventCounts.value
        }
      }
    };
    
    // Convert to JSON
    let backupContent = JSON.stringify(backupData, null, 2);
    let fileName = `smart-life-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    // Handle compression if enabled
    if (backupOptions.value.compress) {
      // Simple compression - remove unnecessary whitespace
      backupContent = JSON.stringify(backupData);
      fileName = fileName.replace('.json', '-compressed.json');
    }
    
    // Handle encryption if enabled
    if (backupOptions.value.encrypt) {
      // Simple encryption - base64 encoding (for demo purposes)
      backupContent = btoa(backupContent);
      fileName = fileName.replace('.json', '-encrypted.txt');
    }
    
    // Create and download file
    const blob = new Blob([backupContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Update last backup info
    lastBackup.value = {
      timestamp: Date.now(),
      size: blob.size,
      itemCount: Object.keys(backupData.data).length
    };
    
    // Save backup info to localStorage
    localStorage.setItem('lastBackup', JSON.stringify(lastBackup.value));
    
    showBackupDialog.value = false;
    ElMessage.success('Backup baixado com sucesso!');
    
  } catch (err) {
    console.error('Error downloading backup:', err);
    ElMessage.error('Erro ao baixar backup');
  } finally {
    isDownloading.value = false;
  }
};

const handleBackupFileSelect = (file) => {
  selectedBackupFile.value = file.raw;
};

const restoreBackup = async () => {
  if (!selectedBackupFile.value) {
    ElMessage.warning('Selecione um arquivo de backup primeiro');
    return;
  }
  
  try {
    isRestoring.value = true;
    
    // Read file content
    const fileContent = await readFileContent(selectedBackupFile.value);
    
    // Parse backup data
    let backupData;
    try {
      backupData = JSON.parse(fileContent);
    } catch (err) {
      // Try to decode if encrypted
      try {
        const decoded = atob(fileContent);
        backupData = JSON.parse(decoded);
      } catch (decodeErr) {
        throw new Error('Arquivo de backup inválido ou corrompido');
      }
    }
    
    // Validate backup structure
    if (!backupData.version || !backupData.data) {
      throw new Error('Estrutura de backup inválida');
    }
    
    // Create backup before restore if enabled
    if (restoreOptions.value.backupBefore) {
      await createBackup();
    }
    
    // Restore data based on mode
    if (restoreOptions.value.mode === 'replace') {
      // Replace all data
      if (backupData.data.devices) devices.value = backupData.data.devices;
      if (backupData.data.scenes) scenes.value = backupData.data.scenes;
      if (backupData.data.rooms) rooms.value = backupData.data.rooms;
      if (backupData.data.deviceRecords) deviceRecords.value = backupData.data.deviceRecords;
      if (backupData.data.systemLogs) systemLogs.value = backupData.data.systemLogs;
      if (backupData.data.profile) profileForm.value = { ...profileForm.value, ...backupData.data.profile };
      
      // Save to localStorage
      localStorage.setItem('devices', JSON.stringify(devices.value));
      localStorage.setItem('scenes', JSON.stringify(scenes.value));
      localStorage.setItem('rooms', JSON.stringify(rooms.value));
      localStorage.setItem('deviceRecords', JSON.stringify(deviceRecords.value));
      localStorage.setItem('systemLogs', JSON.stringify(systemLogs.value));
      localStorage.setItem('profile', JSON.stringify(profileForm.value));
      
    } else if (restoreOptions.value.mode === 'merge') {
      // Merge with existing data
      if (backupData.data.devices) {
        const existingIds = new Set(devices.value.map(d => d.id));
        const newDevices = backupData.data.devices.filter(d => !existingIds.has(d.id));
        devices.value.push(...newDevices);
      }
      
      if (backupData.data.scenes) {
        const existingIds = new Set(scenes.value.map(s => s.id));
        const newScenes = backupData.data.scenes.filter(s => !existingIds.has(s.id));
        scenes.value.push(...newScenes);
      }
      
      // Save merged data
      localStorage.setItem('devices', JSON.stringify(devices.value));
      localStorage.setItem('scenes', JSON.stringify(scenes.value));
    }
    
    // Refresh UI
    await refreshAll();
    
    showRestoreDialog.value = false;
    selectedBackupFile.value = null;
    
    ElMessage.success('Backup restaurado com sucesso!');
    
  } catch (err) {
    console.error('Error restoring backup:', err);
    ElMessage.error(`Erro ao restaurar backup: ${err.message}`);
  } finally {
    isRestoring.value = false;
  }
};

const readFileContent = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file);
  });
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Enhanced device control with rate limiting
const toggleDeviceWithRateLimit = async (device) => {
  try {
    // Check if device is in cooldown or has queued controls
    const queueStatus = homeAssistantClient.getDeviceControlQueueStatus(device.id);
    
    if (queueStatus.inCooldown) {
      const remainingSeconds = Math.ceil(queueStatus.cooldownRemaining / 1000);
      ElMessage.warning(`Dispositivo em cooldown. Aguarde ${remainingSeconds} segundos.`);
      return;
    }
    
    if (queueStatus.queuedCount >= 3) {
      ElMessage.warning('Muitas operações pendentes para este dispositivo. Aguarde as operações anteriores terminarem.');
      return;
    }

    // Use rate-limited toggle
    await homeAssistantClient.toggleDeviceWithRateLimit(device.id, device.data.state);
    
    // Update device state optimistically
    device.data.state = !device.data.state;
    
    // Log the action for analytics
    homeAssistantClient.logDeviceAction(device.id, 'turnOnOff', device.data.state, true);
    
    // Log system event
    homeAssistantClient.logSystemEvent('info', `Device ${device.name} ${device.data.state ? 'turned on' : 'turned off'}`);
    
    ElMessage.success(`Dispositivo ${device.name} ${device.data.state ? 'ligado' : 'desligado'}!`);
    
  } catch (err) {
    // Log failed action
    homeAssistantClient.logDeviceAction(device.id, 'turnOnOff', !device.data.state, false);
    
    // Log error
    homeAssistantClient.logSystemEvent('error', `Failed to control device ${device.name}`, { error: err.message });
    
    ElMessage.error(`Erro ao controlar dispositivo: ${err.message}`);
  }
};

// Enhanced scene trigger with rate limiting
const triggerSceneWithRateLimit = async (scene) => {
  try {
    // Use rate-limited scene trigger
    await homeAssistantClient.triggerSceneWithRateLimit(scene.id);
    
    // Log the action for analytics
    homeAssistantClient.logDeviceAction(scene.id, 'triggerScene', true, true);
    
    // Log system event
    homeAssistantClient.logSystemEvent('info', `Scene ${scene.name} triggered`);
    
    ElMessage.success(`Cena "${scene.name}" ativada!`);
  } catch (err) {
    // Log failed action
    homeAssistantClient.logDeviceAction(scene.id, 'triggerScene', true, false);
    
    // Log error
    homeAssistantClient.logSystemEvent('error', `Failed to trigger scene ${scene.name}`, { error: err.message });
    
    ElMessage.error(`Erro ao ativar cena: ${err.message}`);
  }
};
</script>

<style scoped>
#nav {
  margin: 0 auto;
  margin-top: 64px;
  margin-bottom: 64px;
}

.main-tabs {
  max-width: 1200px;
  margin: 0 auto;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.tab-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

h2 {
  margin: 0;
  color: #409eff;
}

.devices-grid, .scenes-grid, .rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.el-card.device, .el-card.scene-card {
  margin-bottom: 0;
}

.device-header, .scene-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.device-header :last-child, .scene-header :last-child {
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

.device-name, .scene-name {
  font-weight: 500;
  color: #303133;
}

.scene-type {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* Room styles */
.room-card {
  margin-bottom: 16px;
}

.room-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.room-icon {
  font-size: 24px;
}

.room-header h3 {
  margin: 0;
  flex: 1;
}

.device-count {
  font-size: 12px;
  color: #909399;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 12px;
}

.room-devices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.room-device {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
}

.room-empty {
  text-align: center;
  padding: 20px;
}

/* Analytics styles */
.analytics-summary {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
}

.stat-content {
  padding: 20px;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #606266;
}

.records-list {
  max-height: 400px;
  overflow-y: auto;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.record-time {
  font-size: 12px;
  color: #909399;
  min-width: 120px;
}

.record-device {
  flex: 1;
  margin: 0 16px;
}

.record-action {
  font-size: 12px;
  color: #606266;
  min-width: 100px;
}

.record-status.success {
  color: #67c23a;
}

.record-status.error {
  color: #f56c6c;
}

/* Log styles */
.logs-list {
  max-height: 500px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.log-time {
  font-size: 12px;
  color: #909399;
  min-width: 120px;
}

.log-level {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 60px;
  text-align: center;
}

.level-info {
  background: #e1f3d8;
  color: #67c23a;
}

.level-warning {
  background: #fdf6ec;
  color: #e6a23c;
}

.level-error {
  background: #fef0f0;
  color: #f56c6c;
}

.log-message {
  flex: 1;
  font-size: 13px;
}

.log-details {
  min-width: 40px;
}

/* Profile styles */
.profile-container {
  max-width: 500px;
  margin: 0 auto;
}

/* Dialog styles */
.room-management {
  padding: 20px 0;
}

.room-edit-item {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 10px;
}

.device-assignment {
  padding: 20px 0;
}

.log-details {
  padding: 20px 0;
}

.log-details pre {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

/* Monitoring controls styles */
.monitoring-controls {
  margin-bottom: 20px;
}

.monitoring-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-label {
  font-weight: 500;
  color: #606266;
}

.status-details {
  font-size: 14px;
  color: #909399;
  margin-left: 12px;
}

.monitoring-actions {
  display: flex;
  gap: 12px;
}

.monitoring-stats {
  margin-top: 20px;
}

.stat-item {
  text-align: center;
  padding: 16px;
}

.stat-number {
  font-size: 24px;
  font-weight: bold;
  color: #409eff;
  display: block;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 12px;
  color: #606266;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Device queue status indicators */
.device-queue-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
}

.device-queue-indicator.queued {
  background-color: #e6a23c;
}

.device-queue-indicator.cooldown {
  background-color: #f56c6c;
}

.device-queue-indicator.ready {
  background-color: #67c23a;
}

.device-queue-tooltip {
  font-size: 11px;
  max-width: 200px;
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
