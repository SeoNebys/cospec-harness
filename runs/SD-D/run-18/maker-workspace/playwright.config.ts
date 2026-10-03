import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:45000,workers:1,fullyParallel:false,use:{baseURL:'http://127.0.0.1:4000',trace:'retain-on-failure'},webServer:{command:'npm start',url:'http://127.0.0.1:4000/api/health',reuseExistingServer:true,timeout:30000}});
