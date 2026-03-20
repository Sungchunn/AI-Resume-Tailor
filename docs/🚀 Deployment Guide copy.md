# FitSloth CRM (UAT) Deployment Guide

This guide details the steps to update the Front-end and Back-end for the UAT environment.

**Server Info:** \* **IP:** 159.65.12.91 | **User:** root | **Access:** ssh root@159.65.12.91

---

## Back-end Deployment (Java/Spring Boot)

Follow these steps in the exact order to ensure you have a fallback if the deployment fails.

### Step 1: Server Side (Backup & Stop)

SSH into the server: ssh root@159.65.12.91 and perform these actions:

1. **Check Service ID:** pm2 list (Find the ID for "FitSloth CRM API")  
2. **Stop Service:** pm2 stop {id}  
3. Create Backup: Rename the current file with the date to prevent it from being overwritten.  
   mv crm-api.jar crm-api-backup/crm-api.bak{DDMMYY}.jar

### Step 2: Local Machine (Build & Upload)

Run these in your local back-end project folder:

1. Package the Application:  
`mvn clean install \-Dspring.profiles.active=uat \-DskipTests`
2. Upload to Server:
   `scp target/crm-api.jar root@159.65.12.91:/root/`

### Step 3: Server Side (Restart)

Go back to your SSH terminal:

1. **Start Service:** pm2 start {id}  
2. Verify: pm2 logs {id}  
   (Check the logs to make sure the Spring Boot application starts correctly.)

---

## Front-end Deployment (Firebase)

Run these in your local front-end project folder:

1. Install dependencies:  
   npm install  
2. Build for UAT:  
   npm run build:uat  
3. Authentication:  
   firebase login  
4. Set Environment:  
   firebase use default  
   ⚠️ CRITICAL: Wait for the confirmation message:  
   "Now using alias default (fitsloth-crm-uat)"  
5. Deploy:  
   firebase deploy
