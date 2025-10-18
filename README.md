# 🍕 Bandit App — Interactive Multi-Armed Bandit “Pizzeria” Simulator

**Bandit** is an interactive desktop application for experimenting with **multi-armed bandit algorithms** in a playful *pizza-topping* scenario.

Each “arm” represents a **topping option**, and each “customer” simulates a recommendation or decision step.  
You can observe how different algorithms balance **exploration vs. exploitation** while optimizing which toppings to suggest over time.

---

## ✨ Features

- 🧩 Test built-in algorithms such as **Greedy**, **ε-Greedy**, **UCB1**, and **Thompson Sampling**  
- 🧠 **Upload your own Python algorithms** (`.py`) and run them instantly  
- 📊 Visualize rewards, acceptance rates, and learning curves in real time  
- 🎲 Use an optional random seed for reproducible runs — or leave it blank for randomness  
- 🔌 Runs completely **offline** using  
  - **Electron** (frontend & visualization)  
  - **Python Quart** (backend computation)  

---

Download Links:
<!-- DOWNLOADS:START -->
### 📥 Downloads (always latest)

- **Windows** – [Bandit-Setup-Windows.exe](https://github.com/kevinkeller021204/bandit/releases/latest/download/Bandit-Setup-Windows.exe)
- **macOS** – [Bandit-macOS.dmg](https://github.com/kevinkeller021204/bandit/releases/latest/download/Bandit-macOS.dmg)

> CI Bundles (for internal pipeline):  
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
5. npm install --save-dev electron
6. npm run build
7. npm start

### Advanced for Development: Start Front- & Backend independently
(may depend on your installed dependencies)
do not commit changes with IS_DEV = 1

1. Set IS_DEV in app.py to 1 for proxy tunneling
2. cd frontend
3. npm i
4. npm run build 
5. npm run dev
6. cd ..
7. cd backend
8. python(3) app.py
(Step 7: in your virtual environment. Must be started and activated, install requirements and all dependencies which may be missing. https://code.visualstudio.com/docs/python/environments)

### How to run tests
1. go into root dir (/bandit)
2. python run_tests.py
2. python3 run_tests.py (if mac)

Have fun!

for urgent pull requests contact kevin.keller@ieee.org, faster response time
