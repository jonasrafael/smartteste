<template>
  <div id="app">
    <header class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <i class="material-icons-round logo-icon">home</i>
          <h1 class="app-title">Smart Life WebApp</h1>
        </div>
        <div class="header-actions">
          <el-button 
            v-if="!isLoggedIn" 
            type="primary" 
            @click="showLoginDialog = true"
            size="large"
          >
            <i class="material-icons-round">login</i>
            Entrar
          </el-button>
          <el-button 
            v-else 
            type="danger" 
            @click="logout"
            size="large"
          >
            <i class="material-icons-round">logout</i>
            Sair
          </el-button>
        </div>
      </div>
    </header>
    
    <main class="app-main">
      <router-view/>
    </main>

    <!-- Login Dialog -->
    <el-dialog 
      v-model="showLoginDialog" 
      title="Login Smart Life" 
      width="400px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <el-form :model="loginForm" label-width="100px">
        <el-form-item label="Usuário">
          <el-input 
            v-model="loginForm.username" 
            placeholder="Seu usuário Tuya"
            prefix-icon="User"
          />
        </el-form-item>
        <el-form-item label="Senha">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="Sua senha Tuya"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        <el-form-item label="Região">
          <el-select v-model="loginForm.region" placeholder="Selecione a região">
            <el-option label="Europa" value="eu" />
            <el-option label="América" value="us" />
            <el-option label="Ásia" value="as" />
          </el-select>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showLoginDialog = false">Cancelar</el-button>
        <el-button 
          type="primary" 
          @click="handleLogin"
          :loading="isLoggingIn"
        >
          Entrar
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import HomeAssistantClient from './libs/tuya-enhanced.js'

const router = useRouter()
const showLoginDialog = ref(false)
const isLoggingIn = ref(false)
const loginForm = ref({
  username: '',
  password: '',
  region: 'eu'
})

const homeAssistantClient = new HomeAssistantClient()
const isLoggedIn = computed(() => !!homeAssistantClient.getSession())

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    ElMessage.warning('Por favor, preencha usuário e senha')
    return
  }

  isLoggingIn.value = true
  try {
    await homeAssistantClient.login(
      loginForm.value.username,
      loginForm.value.password,
      loginForm.value.region
    )
    
    ElMessage.success('Login realizado com sucesso!')
    showLoginDialog.value = false
    
    // Redirect to main app
    router.push('/')
  } catch (error) {
    ElMessage.error(`Erro no login: ${error.message}`)
  } finally {
    isLoggingIn.value = false
  }
}

const logout = () => {
  homeAssistantClient.logout()
  ElMessage.success('Logout realizado com sucesso!')
  router.push('/')
}

onMounted(() => {
  // Check if user is already logged in
  if (homeAssistantClient.getSession()) {
    router.push('/')
  }
})
</script>

<style>
@import url("https://fonts.googleapis.com/icon?family=Material+Icons+Round");

#app {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  font-size: 32px;
  color: #667eea;
}

.app-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-content {
    padding: 12px 16px;
    flex-direction: column;
    gap: 16px;
  }
  
  .app-title {
    font-size: 20px;
  }
  
  .app-main {
    padding: 16px;
  }
}
</style>
