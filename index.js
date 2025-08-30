import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import HomeEnhanced from '../views/HomeEnhanced.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  }, {
    path: '/enhanced',
    name: 'HomeEnhanced',
    component: HomeEnhanced
  }, {
    path: '/:catchAll(.*)',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
