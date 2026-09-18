import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'ui-test',use:{baseURL:'http://127.0.0.1:4175',viewport:{width:1460,height:850}},webServer:{command:'python3 -m http.server 4175 --bind 127.0.0.1 --directory dist',url:'http://127.0.0.1:4175',reuseExistingServer:false},reporter:'list'});
