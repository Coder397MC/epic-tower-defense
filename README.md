# 🏰 Tower Defense Game

A browser-based tower defense game built with HTML5 Canvas and JavaScript. Defend your castle from waves of enemies by strategically placing towers along their path.

## 🎮 How to Play

### Objective
Protect your castle from incoming enemies by building towers that automatically attack enemies within range. Survive as many waves as possible while managing your gold resources.

### Controls
- **Mouse**: Click to place towers or select existing towers
- **Keyboard Shortcuts**:
  - `1` - Select Archer Tower
  - `2` - Select Knight Tower  
  - `3` - Select Ice Mage Tower
  - `4` - Select Cannon Tower
  - `5` - Select Lightning Tower
  - `R` - Remove Tower mode
  - `P` or `Space` - Pause/Resume game
  - `Escape` - Deselect current tower

### Tower Types

| Tower | Cost | Range | Special Ability |
|-------|------|-------|----------------|
| 🏹 **Archer** | 50g | 100 | Basic ranged attacks |
| ⚔️ **Knight** | 100g | 80 | High damage melee |
| ❄️ **Ice Mage** | 150g | 120 | Slows enemies |
| 💣 **Cannon** | 120g | 90 | Area damage |
| ⚡ **Lightning** | 180g | 110 | Chain lightning |

### Game Mechanics
- **Waves**: Enemies spawn in waves with increasing difficulty
- **Boss Fights**: Every 10th wave features a powerful boss enemy
- **Level Progression**: Every 20 waves advances to the next level
- **Tower Upgrades**: Click on placed towers to upgrade them (double-click)
- **Gold Economy**: Earn gold by defeating enemies, spend it on towers
- **Castle Health**: Your castle starts with 100 HP - don't let it reach 0!

## 🚀 Getting Started

1. Clone or download this repository
2. Open `index.html` in a modern web browser
3. Click "START GAME" to begin
4. Place your first tower and defend your castle!

## 📁 Project Structure

```
tower-defense/
├── index.html      # Main HTML file with game UI
├── game.js         # Core game logic and classes
├── style.css       # Game styling and UI design
└── README.md       # This file
```

## 🛠️ Technical Details

### Built With
- **HTML5 Canvas** - Game rendering
- **Vanilla JavaScript** - Game logic and mechanics
- **CSS3** - UI styling and animations

### Key Features
- Real-time enemy pathfinding
- Dynamic tower placement with collision detection
- Particle effects and damage indicators
- Responsive UI with keyboard shortcuts
- Progressive difficulty scaling
- Boss battle mechanics

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## 🎯 Game Strategy Tips

1. **Early Game**: Start with Archer towers for cost efficiency
2. **Chokepoints**: Place towers at path corners for maximum coverage
3. **Tower Synergy**: Combine Ice Mages with high-damage towers
4. **Economy**: Balance tower purchases with upgrade investments
5. **Boss Preparation**: Save gold before boss waves (every 10th wave)

## 🔧 Development

### Adding New Tower Types
1. Add tower button HTML in `index.html`
2. Define tower properties in the `Tower` class constructor
3. Add tower selection logic in `selectTowerForPlacement()`
4. Update cost and range calculations

### Modifying Enemy Waves
- Edit the `spawnWave()` function to adjust enemy counts and health
- Modify `spawnBossWave()` for boss mechanics
- Update scaling formulas for difficulty progression

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 🎮 Have Fun!

Enjoy defending your castle and see how many waves you can survive! Challenge your friends to beat your high score.