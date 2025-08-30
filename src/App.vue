<template>
  <div id="app">
    <nav class="app-nav">
      <router-link to="/" class="nav-link">Versão Original</router-link>
      <router-link to="/enhanced" class="nav-link">Versão Aprimorada</router-link>
    </nav>
    <router-view/>
  </div>
</template>

<style>
@import url("https://fonts.googleapis.com/icon?family=Material+Icons+Round");

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

.app-nav {
  background: #409eff;
  padding: 16px;
  margin-bottom: 0;
  display: flex;
  justify-content: center;
  gap: 24px;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.nav-link.router-link-active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: bold;
}
</style>
