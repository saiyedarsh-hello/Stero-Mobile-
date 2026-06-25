# Stero Mobile

A modern, native music streaming and downloading app built with React Native and Expo. Stero Mobile bypasses web-only limitations to fetch real-time audio streams directly to your physical device.

## Prerequisites

Before running the project, make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [Git](https://git-scm.com/)
- The **Expo Go** app installed on your physical iOS or Android device.

## How to Run the App

Since Stero utilizes native audio streaming engines, **it cannot be run in a web browser**. It must be run on a physical device.

1. **Install Dependencies**
   Run the following command in the root folder to install all required packages:
   ```bash
   npm install
   ```

2. **Start the Expo Server**
   Start the Metro bundler by running:
   ```bash
   npx expo start -c
   ```

3. **Connect Your Device**
   - **DO NOT** press `w` to open the web browser.
   - Open the **Expo Go** app on your phone.
   - Scan the **QR Code** that appears in your terminal.
   - The app will seamlessly build and launch on your device!

## How to Test

Currently, the most effective way to test the application is through manual verification on your physical device. Ensure that:
- Audio playback initializes properly.
- The player bar syncs correctly with the Zustand state store.
- API requests successfully return real data streams.

## How to Push Code Changes

When you have made modifications and want to save them to this repository:

1. Stage your changes:
   ```bash
   git add .
   ```

2. Commit your changes with a descriptive message:
   ```bash
   git commit -m "Your descriptive message here"
   ```

3. Push the changes to GitHub:
   ```bash
   git push origin master
   ```
*(Note: If your default branch is `main`, use `git push origin main` instead).*
