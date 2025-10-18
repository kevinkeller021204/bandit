# bandit
Download Links:
<!-- DOWNLOADS:START -->
### 📥 Downloads (always latest)

- **Windows** – [Bandit-Setup-Windows.exe](https://github.com/kevinkeller021204/bandit/releases/latest/download/Bandit-Setup-Windows.exe)
- **macOS** – [Bandit-macOS.dmg](https://github.com/kevinkeller021204/bandit/releases/latest/download/Bandit-macOS.dmg)

> CI Bundles (for internal pipeline, dont download):  
> - [bandit-local-windows.zip](https://github.com/kevinkeller021204/bandit/releases/latest/download/bandit-local-windows.zip)  
> - [bandit-local-macos.zip](https://github.com/kevinkeller021204/bandit/releases/latest/download/bandit-local-macos.zip)
<!-- DOWNLOADS:END -->

### macOS – IMPORTANT - First installation
If you see “Bandit App is damaged” on first launch:

1. Open Terminal (Applications > Utilities > Terminal)
2. insert:
   sudo xattr -rd com.apple.quarantine "/Applications/Bandit App.app"
3. Restart app - will work now.

### Start via terminal (with Electron)
1. Clone repo
2. Open repo (e.g. vs code)
3. open terminal (in vs code)
4. cd desktop
5. npm install --save-dev electron //may take a while, ignore warnings
6. npm run build
7. npm start

Have fun!

for urgent pull requests contact kevin.keller@ieee.org, faster response time
