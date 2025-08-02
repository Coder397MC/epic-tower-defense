class Game {
    constructor() {
        console.log('Initializing game...');
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        // Set fixed canvas size
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvas.style.width = '800px';
        this.canvas.style.height = '600px';

        // Game state
        this.gold = 75; // Reduced starting gold for more challenge
        this.isPaused = false;
        this.gameStarted = false; // Start with ready prompt
        this.level = 1;
        this.wave = 1;
        this.castleHealth = 100;
        this.enemies = [];
        this.towers = [];
        this.path = this.createPath();
        this.waveInProgress = false;
        this.damageTexts = [];
        this.currentBoss = null;
        this.bossWave = false;
        this.levelCompleteTimer = 0;

        console.log('Path created:', this.path);

        // Bind event listeners
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.getElementById('basicTower').addEventListener('click', () => this.selectTowerForPlacement('basic'));
        document.getElementById('powerTower').addEventListener('click', () => this.selectTowerForPlacement('power'));
        document.getElementById('freezeTower').addEventListener('click', () => this.selectTowerForPlacement('freeze'));
        document.getElementById('cannonTower').addEventListener('click', () => this.selectTowerForPlacement('cannon'));
        document.getElementById('lightningTower').addEventListener('click', () => this.selectTowerForPlacement('lightning'));
        document.getElementById('removeTower').addEventListener('click', () => this.selectTowerForPlacement('remove'));
        document.getElementById('pauseButton').addEventListener('click', () => this.togglePause());

        // Add keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyPress.bind(this));

        this.selectedTower = null;
        this.selectedTowerType = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.selectedTowerTimeout = null;

        // Update HUD
        this.updateHUD();

        // Start the game loop (only once!)
        this.lastTime = 0;
        this.gameLoop();
    }

    createPath() {
        // Define the path waypoints (x, y coordinates)
        return [
            { x: 50, y: 300 },  // Start more inside the canvas
            { x: 200, y: 300 },
            { x: 200, y: 150 },
            { x: 500, y: 150 },
            { x: 500, y: 450 },
            { x: 700, y: 450 }  // End before canvas edge for castle
        ];
    }

    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Handle start button
        if (!this.gameStarted && this.startButton) {
            if (x >= this.startButton.x && x <= this.startButton.x + this.startButton.width &&
                y >= this.startButton.y && y <= this.startButton.y + this.startButton.height) {
                this.gameStarted = true;
                this.startButton = null;
                return;
            }
        }

        // Don't handle other clicks if game hasn't started
        if (!this.gameStarted) return;

        // Handle tower removal
        if (this.selectedTower === 'remove') {
            const clickedTower = this.towers.find(tower =>
                Math.hypot(tower.x - x, tower.y - y) < 20
            );
            if (clickedTower) {
                this.towers = this.towers.filter(t => t !== clickedTower);
                this.gold += Math.floor(this.getTowerCost(clickedTower.type) * 0.5); // Refund 50%
                this.updateHUD();
            }
            this.selectedTower = null;
            return;
        }

        // Handle tower placement
        if (this.selectedTower && this.gold >= this.getTowerCost(this.selectedTower)) {
            if (this.isValidTowerPlacement(x, y)) {
                this.towers.push(new Tower(x, y, this.selectedTower));
                this.gold -= this.getTowerCost(this.selectedTower);
                this.updateHUD();
                // Don't clear selection - allows rapid placement
            }
        } else {
            // First, deselect all towers
            this.towers.forEach(tower => {
                tower.selected = false;
            });

            // Then select the clicked tower for range display
            const clickedTower = this.towers.find(tower =>
                Math.hypot(tower.x - x, tower.y - y) < 20
            );

            if (clickedTower) {
                // Double-click to upgrade tower
                if (clickedTower.selected && clickedTower.canUpgrade() && this.gold >= clickedTower.upgradeCost) {
                    this.gold -= clickedTower.upgradeCost;
                    clickedTower.upgrade();
                    this.updateHUD();
                    console.log('Tower upgraded to level', clickedTower.level);
                } else {
                    clickedTower.selected = true;
                    console.log('Tower selected, showing range:', clickedTower.range);

                    // Clear any existing timeout
                    if (this.selectedTowerTimeout) {
                        clearTimeout(this.selectedTowerTimeout);
                    }

                    // Auto-deselect after 5 seconds
                    this.selectedTowerTimeout = setTimeout(() => {
                        clickedTower.selected = false;
                        this.selectedTowerTimeout = null;
                    }, 5000);
                }
            } else {
                // Clear any existing timeout when clicking empty space
                if (this.selectedTowerTimeout) {
                    clearTimeout(this.selectedTowerTimeout);
                    this.selectedTowerTimeout = null;
                }
            }
        }
    }

    getTowerCost(type) {
        switch (type) {
            case 'power': return 100;
            case 'freeze': return 150;
            case 'cannon': return 120;
            case 'lightning': return 180;
            case 'basic': return 50;
            default: return 0;
        }
    }

    isValidTowerPlacement(x, y) {
        // Simple path collision check
        for (let i = 0; i < this.path.length - 1; i++) {
            const start = this.path[i];
            const end = this.path[i + 1];

            // Check if point is too close to path segment (reduced from 40 to 25)
            const distance = this.pointToLineDistance(x, y, start.x, start.y, end.x, end.y);
            if (distance < 25) return false;
        }
        return true;
    }

    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;

        if (len_sq != 0) param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    selectTowerForPlacement(type) {
        this.selectedTower = type;
        // Update button visual states
        document.querySelectorAll('.tower-button').forEach(btn => {
            btn.classList.remove('selected');
        });
        if (type !== 'remove') {
            document.getElementById(type + 'Tower').classList.add('selected');
        } else {
            document.getElementById('removeTower').classList.add('selected');
        }

        // Show selection feedback
        console.log(`Tower selected: ${type}`);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseButton = document.getElementById('pauseButton');
        pauseButton.textContent = this.isPaused ? 'Resume' : 'Pause';
        pauseButton.classList.toggle('paused', this.isPaused);
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
    }

    handleKeyPress(event) {
        // Only handle keys if game has started
        if (!this.gameStarted) return;

        switch (event.key) {
            case '1':
                this.selectTowerForPlacement('basic');
                break;
            case '2':
                this.selectTowerForPlacement('power');
                break;
            case '3':
                this.selectTowerForPlacement('freeze');
                break;
            case '4':
                this.selectTowerForPlacement('cannon');
                break;
            case '5':
                this.selectTowerForPlacement('lightning');
                break;
            case 'r':
            case 'R':
                this.selectTowerForPlacement('remove');
                break;
            case ' ':
            case 'p':
            case 'P':
                event.preventDefault();
                this.togglePause();
                break;
            case 'Escape':
                // Deselect current tower
                this.selectedTower = null;
                document.querySelectorAll('.tower-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
                break;
        }
    }

    drawTowerPlacementPreview() {
        // Only show preview if a tower type is selected for placement
        if (!this.selectedTower || this.selectedTower === 'remove') return;

        // Get tower range based on type
        let range;
        switch (this.selectedTower) {
            case 'power':
                range = 80;
                break;
            case 'freeze':
                range = 120;
                break;
            case 'cannon':
                range = 90;
                break;
            case 'lightning':
                range = 110;
                break;
            case 'basic':
            default:
                range = 100;
                break;
        }

        // Check if placement is valid
        const isValid = this.isValidTowerPlacement(this.mouseX, this.mouseY);
        const canAfford = this.gold >= this.getTowerCost(this.selectedTower);

        // Draw range circle
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.strokeStyle = isValid && canAfford ? '#2ecc71' : '#e74c3c';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, range, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw tower preview
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillStyle = isValid && canAfford ? '#2ecc71' : '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, 15, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw tower type indicator
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        let towerSymbol;
        switch (this.selectedTower) {
            case 'power':
                towerSymbol = 'K'; // Knight
                break;
            case 'freeze':
                towerSymbol = 'M'; // Mage
                break;
            case 'cannon':
                towerSymbol = 'C'; // Cannon
                break;
            case 'lightning':
                towerSymbol = 'L'; // Lightning
                break;
            case 'basic':
            default:
                towerSymbol = 'A'; // Archer
                break;
        }
        this.ctx.fillText(towerSymbol, this.mouseX, this.mouseY + 4);

        this.ctx.restore();
    }

    spawnWave() {
        console.log('Spawning wave:', this.wave);

        // Check if this is a boss wave (every 10 waves)
        if (this.wave % 10 === 0) {
            this.spawnBossWave();
            return;
        }

        // Make early waves much easier
        let baseHealth;
        if (this.wave <= 3) {
            baseHealth = 1; // Very easy first 3 waves
        } else if (this.wave <= 6) {
            baseHealth = 2; // Still easy waves 4-6
        } else {
            baseHealth = 1 + Math.floor(this.wave * 0.8); // Gradual scaling after wave 6
        }

        const enemyCount = 3 + Math.floor(this.wave / 3); // Fewer enemies early on

        for (let i = 0; i < enemyCount; i++) {
            setTimeout(() => {
                // Always spawn from the first path point (left side)
                const startX = this.path[0].x;
                const startY = this.path[0].y;
                const enemy = new Enemy(startX, startY, baseHealth, this.wave, this);
                enemy.pathIndex = 0; // Ensure they start at the beginning
                this.enemies.push(enemy);
                console.log('Enemy spawned:', enemy.type, 'HP:', enemy.health, 'at:', startX, startY);
            }, i * 1000); // Spawn enemy every 1 second
        }

        this.waveInProgress = true;
    }

    spawnBossWave() {
        console.log('Spawning BOSS wave:', this.wave);
        this.bossWave = true;

        // Create boss enemy
        const startX = this.path[0].x;
        const startY = this.path[0].y;
        const bossHealth = 50 + (this.wave * 5); // Scaling boss health

        const boss = new Enemy(startX, startY, bossHealth, this.wave, this);
        boss.pathIndex = 0;
        boss.isBoss = true;
        boss.type = 'boss';
        boss.size = 40;
        boss.health = bossHealth;
        boss.maxHealth = bossHealth;
        boss.damage = 20 + Math.floor(this.wave / 2);
        boss.reward = 100 + (this.wave * 5); // Cut boss reward in half
        boss.baseSpeed = 40; // Slow but powerful
        boss.speed = boss.baseSpeed;

        this.enemies.push(boss);
        this.currentBoss = boss;

        console.log('Boss spawned with', bossHealth, 'HP');
        this.waveInProgress = true;
    }

    showDamageText(x, y, text, color) {
        this.damageTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 1.0,
            maxLife: 1.0
        });
    }

    updateHUD() {
        document.getElementById('goldCount').textContent = this.gold;
        document.getElementById('waveCount').textContent = this.wave;
        document.getElementById('levelCount').textContent = this.level;
        document.getElementById('castleHealth').textContent = this.castleHealth;

        // Update tower button states based on gold
        document.getElementById('basicTower').disabled = this.gold < 50;
        document.getElementById('powerTower').disabled = this.gold < 100;
        document.getElementById('freezeTower').disabled = this.gold < 150;
        document.getElementById('cannonTower').disabled = this.gold < 120;
        document.getElementById('lightningTower').disabled = this.gold < 180;
    }

    gameLoop(currentTime = 0) {
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Clear and draw background
        this.ctx.fillStyle = '#8dba84';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        console.log('Canvas cleared and background drawn');

        // Test drawing - draw a simple red rectangle to verify canvas works
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(10, 10, 50, 50);

        console.log('Game loop running, enemies:', this.enemies.length, 'gameStarted:', this.gameStarted);

        // Handle pause
        if (this.isPaused) {
            // Still draw everything but don't update
            this.drawBackground();
            this.drawPath();
            this.drawCastle();

            this.towers.forEach(tower => {
                tower.draw(this.ctx);
            });

            this.enemies.forEach(enemy => {
                enemy.draw(this.ctx);
            });

            // Draw boss bar if boss exists
            if (this.currentBoss && this.currentBoss.health > 0) {
                this.drawBossBar();
            }

            // Draw pause overlay
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);

            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }

        // Draw background elements
        this.drawBackground();

        // Draw path
        this.drawPath();

        // Draw castle
        this.drawCastle();

        // Update and draw towers
        this.towers.forEach(tower => {
            tower.update(deltaTime, this.enemies);
            tower.draw(this.ctx);
        });

        // Draw tower placement preview
        this.drawTowerPlacementPreview();

        // Update and draw damage texts
        this.damageTexts = this.damageTexts.filter(damageText => {
            damageText.life -= deltaTime * 2;
            damageText.y -= 30 * deltaTime;

            if (damageText.life > 0) {
                this.ctx.save();
                this.ctx.globalAlpha = damageText.life;
                this.ctx.fillStyle = damageText.color;
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = 2;
                this.ctx.strokeText(damageText.text, damageText.x, damageText.y);
                this.ctx.fillText(damageText.text, damageText.x, damageText.y);
                this.ctx.restore();
                return true;
            }
            return false;
        });

        // Update and draw enemies
        this.enemies = this.enemies.filter(enemy => {
            enemy.update(deltaTime);
            enemy.draw(this.ctx);

            // Remove enemy if it reaches the end or dies
            if (enemy.reachedEnd) {
                // Tower takes damage based on enemy level/type
                const damageToTower = enemy.damage + Math.floor(enemy.wave / 3);
                this.castleHealth -= damageToTower;

                // Show damage text
                this.showDamageText(this.path[this.path.length - 1].x + 30,
                    this.path[this.path.length - 1].y - 30,
                    `-${damageToTower}`, '#FF5722');

                this.updateHUD();
                return false;
            }
            if (enemy.health <= 0) {
                this.gold += enemy.reward;
                // If boss dies, clear boss reference
                if (enemy.isBoss) {
                    this.currentBoss = null;
                }
                this.updateHUD();
                return false;
            }
            return true;
        });

        // Draw boss bar if boss exists
        if (this.currentBoss && this.currentBoss.health > 0) {
            this.drawBossBar();
        }

        // Check if wave is complete
        if (this.waveInProgress && this.enemies.length === 0) {
            console.log('Wave completed'); // Debug log
            this.waveInProgress = false;
            this.bossWave = false;
            this.currentBoss = null;
            this.wave++;

            // Check for level progression (every 20 waves)
            if (this.wave % 20 === 1 && this.wave > 1) {
                this.level++;
                this.showLevelComplete();
                setTimeout(() => this.spawnWave(), 5000); // Longer break for level up
            } else {
                setTimeout(() => this.spawnWave(), 3000);
            }

            this.updateHUD();
        }

        // Start first wave (only if game has started)
        if (!this.waveInProgress && this.enemies.length === 0 && this.gameStarted) {
            console.log('Starting wave:', this.wave); // Debug log
            this.spawnWave();
        }

        // Show ready prompt if game hasn't started
        if (!this.gameStarted) {
            this.drawReadyPrompt();
        }

        // Update and draw level complete screen
        if (this.levelCompleteTimer > 0) {
            this.levelCompleteTimer -= deltaTime;
            this.drawLevelComplete();
        }

        // Game over check
        if (this.castleHealth <= 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Over!', this.canvas.width / 2, this.canvas.height / 2);
            return;
        }

        requestAnimationFrame(this.gameLoop.bind(this));
    }

    drawBackground() {
        // Draw grass patches
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.ctx.fillStyle = '#567d46';
            this.ctx.beginPath();
            this.ctx.arc(x, y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawCastle() {
        console.log('Drawing castle...');
        const lastPoint = this.path[this.path.length - 1];
        const x = lastPoint.x;  // Tower at the end of the path
        const y = lastPoint.y - 50;  // Lift tower up from the path

        // Tower base (wider and more fortress-like)
        this.ctx.fillStyle = '#5D4E37';  // Dark brown stone
        this.ctx.fillRect(x - 10, y + 40, 80, 40);

        // Main tower body
        this.ctx.fillStyle = '#8B7D6B';  // Light stone
        this.ctx.fillRect(x, y, 60, 80);

        // Tower battlements
        this.ctx.fillStyle = '#A0937D';
        for (let i = 0; i < 5; i++) {
            this.ctx.fillRect(x + (i * 12), y - 15, 8, 15);
        }

        // Tower door
        this.ctx.fillStyle = '#3E2723';
        this.ctx.beginPath();
        this.ctx.arc(x + 30, y + 65, 12, 0, Math.PI, true);
        this.ctx.fill();
        this.ctx.fillRect(x + 18, y + 53, 24, 27);

        // Tower windows
        this.ctx.fillStyle = '#1A1A1A';
        this.ctx.fillRect(x + 15, y + 25, 8, 12);
        this.ctx.fillRect(x + 37, y + 25, 8, 12);
        this.ctx.fillRect(x + 26, y + 10, 8, 12);

        // Tower flag
        this.ctx.fillStyle = '#C62828';
        this.ctx.fillRect(x + 25, y - 35, 20, 12);
        this.ctx.strokeStyle = '#8D6E63';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 25, y - 35);
        this.ctx.lineTo(x + 25, y - 15);
        this.ctx.stroke();

        // Draw tower health bar (larger and more prominent)
        const healthPercentage = this.castleHealth / 100;
        const barWidth = 80;
        const barHeight = 10;

        // Health bar background
        this.ctx.fillStyle = '#2C1810';
        this.ctx.fillRect(x - 10, y - 50, barWidth, barHeight);

        // Health bar border
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x - 10, y - 50, barWidth, barHeight);

        // Health bar fill
        this.ctx.fillStyle = healthPercentage > 0.6 ? '#4CAF50' : healthPercentage > 0.3 ? '#FF9800' : '#F44336';
        this.ctx.fillRect(x - 8, y - 48, (barWidth - 4) * healthPercentage, barHeight - 4);

        // Health text
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${this.castleHealth}/100`, x + 30, y - 55);
    }

    drawReadyPrompt() {
        // Draw semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw title with glow effect
        this.ctx.shadowColor = '#FFD700';
        this.ctx.shadowBlur = 20;
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 56px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏰 TOWER DEFENSE 🏰', this.canvas.width / 2, this.canvas.height / 2 - 120);
        this.ctx.shadowBlur = 0;

        // Draw level info
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 28px Arial';
        this.ctx.fillText(`Level ${this.level}`, this.canvas.width / 2, this.canvas.height / 2 - 70);

        // Draw "Are you ready?" text
        this.ctx.fillStyle = '#00BCD4';
        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillText('Are you ready?', this.canvas.width / 2, this.canvas.height / 2 - 30);

        // Draw instructions
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '16px Arial';
        this.ctx.fillText('🎯 Build towers to defend your base!', this.canvas.width / 2, this.canvas.height / 2 + 5);
        this.ctx.fillText('🔧 Click towers to see range and upgrade them', this.canvas.width / 2, this.canvas.height / 2 + 25);
        this.ctx.fillText('💰 Earn gold by defeating enemies', this.canvas.width / 2, this.canvas.height / 2 + 45);

        // Draw keyboard shortcuts
        this.ctx.fillStyle = '#00BCD4';
        this.ctx.font = '14px Arial';
        this.ctx.fillText('⌨️ Use hotkeys 1-5 to select towers, R to remove, P to pause', this.canvas.width / 2, this.canvas.height / 2 + 70);

        // Draw animated start button
        const buttonWidth = 250;
        const buttonHeight = 60;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        const buttonY = this.canvas.height / 2 + 100;

        // Button animation
        const pulse = Math.sin(Date.now() / 300) * 0.1 + 1;
        const animButtonWidth = buttonWidth * pulse;
        const animButtonHeight = buttonHeight * pulse;
        const animButtonX = this.canvas.width / 2 - animButtonWidth / 2;
        const animButtonY = buttonY + (buttonHeight - animButtonHeight) / 2;

        // Button glow
        this.ctx.shadowColor = '#27ae60';
        this.ctx.shadowBlur = 15;
        this.ctx.fillStyle = '#27ae60';
        this.ctx.fillRect(animButtonX, animButtonY, animButtonWidth, animButtonHeight);

        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#2ecc71';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(animButtonX, animButtonY, animButtonWidth, animButtonHeight);

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillText('🚀 START GAME 🚀', this.canvas.width / 2, buttonY + 38);

        // Store button bounds for click detection (use original size for easier clicking)
        this.startButton = { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
    }

    showLevelComplete() {
        // This will be shown in the game loop when levelCompleteTimer > 0
        this.levelCompleteTimer = 5.0; // Show for 5 seconds
    }

    drawLevelComplete() {
        if (!this.levelCompleteTimer || this.levelCompleteTimer <= 0) return;

        // Draw semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw level complete message
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('LEVEL COMPLETE!', this.canvas.width / 2, this.canvas.height / 2 - 50);

        this.ctx.fillStyle = '#FFF';
        this.ctx.font = '24px Arial';
        this.ctx.fillText(`Advancing to Level ${this.level}`, this.canvas.width / 2, this.canvas.height / 2 + 10);

        this.ctx.font = '18px Arial';
        this.ctx.fillText('Enemies will be stronger!', this.canvas.width / 2, this.canvas.height / 2 + 40);

        // Countdown
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(`Next wave in ${Math.ceil(this.levelCompleteTimer)} seconds`, this.canvas.width / 2, this.canvas.height / 2 + 80);
    }

    drawBossBar() {
        if (!this.currentBoss || this.currentBoss.health <= 0) return;

        const barWidth = 600;
        const barHeight = 20;
        const barX = (this.canvas.width - barWidth) / 2;
        const barY = 20;

        const healthPercentage = this.currentBoss.health / this.currentBoss.maxHealth;

        // Boss bar background
        this.ctx.fillStyle = '#2C1810';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Boss bar border
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Boss bar fill
        this.ctx.fillStyle = '#8E24AA'; // Purple for boss
        this.ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * healthPercentage, barHeight - 4);

        // Boss name and health text
        this.ctx.fillStyle = '#FFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`BOSS - Wave ${this.wave}`, this.canvas.width / 2, barY - 5);
        this.ctx.fillText(`${this.currentBoss.health}/${this.currentBoss.maxHealth}`, this.canvas.width / 2, barY + barHeight + 20);
    }

    drawPath() {
        console.log('Drawing dirt road...', 'Path:', this.path);

        // Draw main dirt road
        this.ctx.beginPath();
        this.ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            this.ctx.lineTo(this.path[i].x, this.path[i].y);
        }

        // Main dirt road base
        this.ctx.strokeStyle = '#8B7355';  // Light brown dirt
        this.ctx.lineWidth = 45;
        this.ctx.stroke();

        // Darker dirt road center
        this.ctx.strokeStyle = '#6B5B47';  // Darker brown
        this.ctx.lineWidth = 35;
        this.ctx.stroke();

        // Add dirt texture with random dots
        for (let i = 0; i < this.path.length - 1; i++) {
            const start = this.path[i];
            const end = this.path[i + 1];
            const length = Math.hypot(end.x - start.x, end.y - start.y);
            const angle = Math.atan2(end.y - start.y, end.x - start.x);

            for (let j = 0; j < length; j += 8) {
                const x = start.x + (j * Math.cos(angle));
                const y = start.y + (j * Math.sin(angle));

                // Add random dirt particles
                for (let k = 0; k < 3; k++) {
                    const offsetX = (Math.random() - 0.5) * 30;
                    const offsetY = (Math.random() - 0.5) * 30;
                    this.ctx.fillStyle = Math.random() > 0.5 ? '#5D4E3A' : '#7A6B57';
                    this.ctx.beginPath();
                    this.ctx.arc(x + offsetX, y + offsetY, Math.random() * 2 + 1, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        }

        // Add road edges with small stones
        this.ctx.beginPath();
        this.ctx.moveTo(this.path[0].x, this.path[0].y);
        for (let i = 1; i < this.path.length; i++) {
            this.ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        this.ctx.strokeStyle = '#4A3F33';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }
}

class Tower {
    constructor(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.target = null;
        this.projectiles = [];
        this.lastShot = 0;
        this.selected = false;

        // Tower upgrade system
        this.level = 1;
        this.maxLevel = 3;
        this.upgradeCost = 0;

        // Set tower properties based on type
        switch (type) {
            case 'power':
                this.range = 80;
                this.damage = 1.5; // Cut in half from 3
                this.fireRate = 0.8;
                this.color = '#e67e22';
                break;
            case 'freeze':
                this.range = 120;
                this.damage = 0.25; // Cut in half from 0.5
                this.fireRate = 1.5;
                this.color = '#3498db';
                this.freezeEffect = true;
                break;
            case 'cannon':
                this.range = 90;
                this.damage = 2; // New tower type
                this.fireRate = 0.5;
                this.color = '#8b4513';
                this.splashDamage = true;
                break;
            case 'lightning':
                this.range = 110;
                this.damage = 1; // New tower type
                this.fireRate = 1.2;
                this.color = '#9c27b0';
                this.chainLightning = true;
                break;
            default: // Basic archer tower
                this.range = 100;
                this.damage = 0.5; // Cut in half from 1
                this.fireRate = 1;
                this.color = '#27ae60';
                break;
        }

        // Store base values for upgrades
        this.baseDamage = this.damage;
        this.baseRange = this.range;
        this.calculateUpgradeCost();
    }

    update(deltaTime, enemies) {
        // Update projectiles
        this.projectiles = this.projectiles.filter(proj => {
            proj.update(deltaTime);
            return !proj.hit;
        });

        // No cooldown - towers can shoot continuously
        // Find closest enemy in range
        let closestEnemy = null;
        let closestDistance = this.range;

        enemies.forEach(enemy => {
            const distance = Math.hypot(enemy.x - this.x, enemy.y - this.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        });

        // Shoot at closest enemy immediately
        if (closestEnemy) {
            this.projectiles.push(new Projectile(this.x, this.y, closestEnemy, this.damage));
        }
    }

    draw(ctx) {
        // Draw range circle if selected (more visible)
        if (this.selected) {
            // Draw filled range area (more visible)
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#00BCD4';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.fill();

            // Draw animated range border
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = '#00BCD4';
            ctx.lineWidth = 4;
            const dashOffset = (Date.now() / 100) % 20;
            ctx.setLineDash([10, 5]);
            ctx.lineDashOffset = dashOffset;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw range text with background
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(this.x - 40, this.y - this.range - 25, 80, 20);

            ctx.globalAlpha = 1;
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Range: ${Math.round(this.range)}`, this.x, this.y - this.range - 10);
            ctx.fillText(`Dmg: ${this.damage.toFixed(1)} Lv${this.level}`, this.x, this.y - this.range + 5);

            ctx.restore();
        }

        // Draw tower base
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.rect(this.x - 15, this.y - 15, 30, 40);
        ctx.fill();

        // Draw tower top
        ctx.fillStyle = '#95a5a6';
        ctx.beginPath();
        ctx.rect(this.x - 17, this.y - 15, 34, 4);
        ctx.fill();

        // Draw character based on tower type
        switch (this.type) {
            case 'power':
                this.drawKnight(ctx);
                break;
            case 'freeze':
                this.drawMage(ctx);
                break;
            case 'cannon':
                this.drawCannon(ctx);
                break;
            case 'lightning':
                this.drawLightning(ctx);
                break;
            default:
                this.drawArcher(ctx);
                break;
        }

        // Draw projectiles
        this.projectiles.forEach(proj => proj.draw(ctx));

        // Draw projectiles
        this.projectiles.forEach(proj => proj.draw(ctx));

        // Draw upgrade level indicator
        if (this.level > 1) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`Lv${this.level}`, this.x, this.y + 25);
        }
    }

    calculateUpgradeCost() {
        if (this.level >= this.maxLevel) {
            this.upgradeCost = 0;
            return;
        }

        const baseCost = this.type === 'basic' ? 25 : this.type === 'power' ? 50 : 75;
        this.upgradeCost = baseCost * this.level;
    }

    canUpgrade() {
        return this.level < this.maxLevel;
    }

    upgrade() {
        if (!this.canUpgrade()) return false;

        this.level++;

        // Level 1->2: Damage buff
        // Level 2->3: Damage buff + Range buff
        if (this.level === 2) {
            this.damage = this.baseDamage * 2; // Double damage
        } else if (this.level === 3) {
            this.damage = this.baseDamage * 3; // Triple damage
            this.range = this.baseRange * 1.3; // 30% more range
        }

        this.calculateUpgradeCost();
        return true;
    }

    drawArcher(ctx) {
        // Body
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - 5, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 18, 5, 0, Math.PI * 2);
        ctx.fill();

        // Hood
        ctx.strokeStyle = '#218f54';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 18, 6, -Math.PI, 0);
        ctx.stroke();

        // Bow
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + 8, this.y - 10, 8, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        // Arrow
        ctx.strokeStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(this.x + 4, this.y - 10);
        ctx.lineTo(this.x + 12, this.y - 10);
        ctx.stroke();
    }

    drawKnight(ctx) {
        // Body (armor)
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - 5, 7, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head with helmet
        ctx.fillStyle = '#d35400';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 18, 6, 0, Math.PI * 2);
        ctx.fill();

        // Helmet details
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x - 6, this.y - 18);
        ctx.lineTo(this.x + 6, this.y - 18);
        ctx.stroke();

        // Sword
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + 5, this.y - 15);
        ctx.lineTo(this.x + 15, this.y - 5);
        ctx.stroke();

        // Sword handle
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + 8, this.y - 12);
        ctx.lineTo(this.x + 12, this.y - 16);
        ctx.stroke();
    }

    drawMage(ctx) {
        // Robe
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.moveTo(this.x - 8, this.y + 5);
        ctx.lineTo(this.x + 8, this.y + 5);
        ctx.lineTo(this.x + 6, this.y - 10);
        ctx.lineTo(this.x - 6, this.y - 10);
        ctx.closePath();
        ctx.fill();

        // Head
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 18, 5, 0, Math.PI * 2);
        ctx.fill();

        // Wizard hat
        ctx.fillStyle = '#2980b9';
        ctx.beginPath();
        ctx.moveTo(this.x - 8, this.y - 20);
        ctx.lineTo(this.x, this.y - 35);
        ctx.lineTo(this.x + 8, this.y - 20);
        ctx.closePath();
        ctx.fill();

        // Staff
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + 10, this.y + 5);
        ctx.lineTo(this.x + 10, this.y - 15);
        ctx.stroke();

        // Magic orb
        ctx.fillStyle = '#1abc9c';
        ctx.beginPath();
        ctx.arc(this.x + 10, this.y - 18, 4, 0, Math.PI * 2);
        ctx.fill();

        // Magic sparkles
        for (let i = 0; i < 3; i++) {
            const angle = (Date.now() / 500 + i * Math.PI * 2 / 3) % (Math.PI * 2);
            const sparkleX = this.x + 10 + Math.cos(angle) * 8;
            const sparkleY = this.y - 18 + Math.sin(angle) * 8;
            ctx.fillStyle = '#1abc9c';
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawCannon(ctx) {
        // Cannon base
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 5, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cannon barrel
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.rect(this.x - 3, this.y - 15, 6, 20);
        ctx.fill();

        // Cannon mouth
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 15, 4, 0, Math.PI * 2);
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#8b4513';
        ctx.beginPath();
        ctx.arc(this.x - 8, this.y + 8, 4, 0, Math.PI * 2);
        ctx.arc(this.x + 8, this.y + 8, 4, 0, Math.PI * 2);
        ctx.fill();

        // Smoke effect (random)
        if (Math.random() > 0.8) {
            ctx.fillStyle = '#95a5a6';
            ctx.beginPath();
            ctx.arc(this.x + (Math.random() - 0.5) * 6, this.y - 20 - Math.random() * 5, Math.random() * 2 + 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawLightning(ctx) {
        // Lightning rod base
        ctx.fillStyle = '#9c27b0';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 5, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Lightning rod
        ctx.strokeStyle = '#7b1fa2';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 5);
        ctx.lineTo(this.x, this.y - 20);
        ctx.stroke();

        // Lightning orb
        ctx.fillStyle = '#e1bee7';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 20, 6, 0, Math.PI * 2);
        ctx.fill();

        // Electric sparks
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const angle = (Date.now() / 200 + i * Math.PI / 2) % (Math.PI * 2);
            const sparkX = this.x + Math.cos(angle) * 12;
            const sparkY = this.y - 20 + Math.sin(angle) * 12;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - 20);
            ctx.lineTo(sparkX, sparkY);
            ctx.stroke();
        }

        // Lightning bolt effect (random)
        if (Math.random() > 0.7) {
            ctx.strokeStyle = '#ffeb3b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - 25);
            ctx.lineTo(this.x - 5, this.y - 35);
            ctx.lineTo(this.x + 3, this.y - 35);
            ctx.lineTo(this.x - 2, this.y - 45);
            ctx.stroke();
        }
    }
}

class Projectile {
    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 300;
        this.hit = false;
    }

    update(deltaTime) {
        if (this.hit) return;

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 5) {
            this.hit = true;
            this.target.health -= this.damage;
            return;
        }

        this.x += (dx / distance) * this.speed * deltaTime;
        this.y += (dy / distance) * this.speed * deltaTime;
    }

    draw(ctx) {
        // Draw arrow
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.target.y - this.y, this.target.x - this.x));

        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;

        // Arrow shaft
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(4, 0);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(0, -3);
        ctx.lineTo(0, 3);
        ctx.closePath();
        ctx.fillStyle = '#2c3e50';
        ctx.fill();

        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, health, wave, game) {
        this.x = x;
        this.y = y;
        this.health = health;
        this.maxHealth = health;
        this.baseSpeed = 100;
        this.speed = this.baseSpeed;
        this.pathIndex = 0;
        this.reachedEnd = false;
        this.wave = wave;
        this.freezeTimer = 0;
        this.game = game; // Store reference to game instance

        // Determine enemy type based on wave and random chance
        this.setEnemyType(wave);
    }

    setEnemyType(wave) {
        const rand = Math.random();

        // Make early waves only have goblins for easier gameplay
        if (wave <= 3) {
            this.type = 'goblin';
            this.color = '#4CAF50';
            this.size = 15;
            this.damage = 1;
            this.reward = 5; // Cut goblin reward in half
            return;
        }

        if (wave % 10 === 0) {
            // Dragon Boss every 10 waves
            this.type = 'dragon';
            this.color = '#8E24AA';
            this.size = 35;
            this.health *= 6; // Reduced from 8
            this.maxHealth = this.health;
            this.damage = 12; // Reduced from 15
            this.reward = 50; // Cut dragon reward in half
            this.baseSpeed = 60;
            this.speed = this.baseSpeed;
        } else if (wave % 5 === 0) {
            // Armored Knight Boss every 5 waves
            this.type = 'knight';
            this.color = '#37474F';
            this.size = 28;
            this.health *= 3; // Reduced from 5
            this.maxHealth = this.health;
            this.damage = 5; // Reduced from 8
            this.reward = 25; // Cut knight reward in half
            this.baseSpeed = 70;
            this.speed = this.baseSpeed;
        } else if (wave <= 6 || rand < 0.6) {
            // More goblins in early waves, 60% chance later
            this.type = 'goblin';
            this.color = '#4CAF50';
            this.size = 15;
            this.damage = 1;
            this.reward = 5; // Cut goblin reward in half
        } else if (rand < 0.75) {
            // Fast Scout (15% chance)
            this.type = 'scout';
            this.color = '#4CAF50';
            this.size = 12;
            this.health = Math.max(1, Math.floor(this.health * 0.7)); // Slightly more HP
            this.maxHealth = this.health;
            this.damage = 2;
            this.reward = 8; // Cut scout reward in half (rounded up)
            this.baseSpeed = 150; // Reduced speed
            this.speed = this.baseSpeed;
        } else if (rand < 0.85) {
            // Heavy Orc (10% chance)
            this.type = 'orc';
            this.color = '#8D6E63';
            this.size = 22;
            this.health = Math.floor(this.health * 1.3); // Reduced multiplier
            this.maxHealth = this.health;
            this.damage = 3; // Reduced damage
            this.reward = 25;
            this.baseSpeed = 70; // Slightly faster
            this.speed = this.baseSpeed;
        } else {
            // Fire Demon (15% chance)
            this.type = 'demon';
            this.color = '#F44336';
            this.size = 18;
            this.health = Math.floor(this.health * 1.1); // Reduced multiplier
            this.maxHealth = this.health;
            this.damage = 2; // Reduced damage
            this.reward = 10; // Cut demon reward in half
            this.baseSpeed = 100; // Reduced speed
            this.speed = this.baseSpeed;
        }
    }

    update(deltaTime) {
        if (this.pathIndex >= this.game.path.length - 1) {
            this.reachedEnd = true;
            return;
        }

        // Update freeze effect
        if (this.freezeTimer > 0) {
            this.freezeTimer -= deltaTime;
            if (this.freezeTimer <= 0) {
                this.speed = this.baseSpeed;
            }
        }

        const targetPoint = this.game.path[this.pathIndex + 1];
        const dx = targetPoint.x - this.x;
        const dy = targetPoint.y - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 5) {
            this.pathIndex++;
            return;
        }

        this.x += (dx / distance) * this.speed * deltaTime;
        this.y += (dy / distance) * this.speed * deltaTime;
    }

    draw(ctx) {
        // Drawing enemy

        // Draw enemy based on type
        switch (this.type) {
            case 'boss':
                this.drawBoss(ctx);
                break;
            case 'dragon':
                this.drawDragon(ctx);
                break;
            case 'knight':
                this.drawKnight(ctx);
                break;
            case 'scout':
                this.drawScout(ctx);
                break;
            case 'orc':
                this.drawOrc(ctx);
                break;
            case 'demon':
                this.drawDemon(ctx);
                break;
            default:
                this.drawGoblin(ctx);
                break;
        }

        // Draw health bar
        const healthBarWidth = Math.max(25, this.size + 10);
        const healthBarHeight = 5;
        const healthPercentage = this.health / this.maxHealth;

        // Health bar background
        ctx.fillStyle = '#2C1810';
        ctx.fillRect(this.x - healthBarWidth / 2, this.y - this.size - 15, healthBarWidth, healthBarHeight);

        // Health bar fill
        ctx.fillStyle = healthPercentage > 0.6 ? '#4CAF50' : healthPercentage > 0.3 ? '#FF9800' : '#F44336';
        ctx.fillRect(this.x - healthBarWidth / 2 + 1, this.y - this.size - 14, (healthBarWidth - 2) * healthPercentage, healthBarHeight - 2);

        // Health bar border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - healthBarWidth / 2, this.y - this.size - 15, healthBarWidth, healthBarHeight);
    }

    drawGoblin(ctx) {
        // Body
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 0.8, this.size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.7, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.arc(this.x - 3, this.y - this.size * 0.7, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 3, this.y - this.size * 0.7, 2, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 0.8, this.size, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawScout(ctx) {
        // Body (lean and fast)
        ctx.fillStyle = '#8BC34A';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 0.6, this.size * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#9CCC65';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.8, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Speed lines
        ctx.strokeStyle = '#689F38';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x - this.size - 5 - i * 3, this.y - 2 + i * 2);
            ctx.lineTo(this.x - this.size - 15 - i * 3, this.y - 2 + i * 2);
            ctx.stroke();
        }
    }

    drawOrc(ctx) {
        // Body (bulky)
        ctx.fillStyle = '#8D6E63';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#A1887F';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.6, this.size * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Tusks
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - this.size * 0.4, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - this.size * 0.4, 2, 0, Math.PI * 2);
        ctx.fill();

        // Armor details
        ctx.strokeStyle = '#5D4037';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.8, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    drawDemon(ctx) {
        // Body (fiery)
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 0.9, this.size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#E53935';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.7, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.fillStyle = '#B71C1C';
        ctx.beginPath();
        ctx.moveTo(this.x - 6, this.y - this.size * 0.9);
        ctx.lineTo(this.x - 3, this.y - this.size * 1.2);
        ctx.lineTo(this.x - 1, this.y - this.size * 0.9);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x + 6, this.y - this.size * 0.9);
        ctx.lineTo(this.x + 3, this.y - this.size * 1.2);
        ctx.lineTo(this.x + 1, this.y - this.size * 0.9);
        ctx.fill();

        // Fire effect
        if (Math.random() > 0.7) {
            ctx.fillStyle = '#FF9800';
            ctx.beginPath();
            ctx.arc(this.x + (Math.random() - 0.5) * this.size,
                this.y + (Math.random() - 0.5) * this.size,
                Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawKnight(ctx) {
        // Body (armored)
        ctx.fillStyle = '#37474F';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 0.9, this.size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head with helmet
        ctx.fillStyle = '#455A64';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.7, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Helmet plume
        ctx.fillStyle = '#F44336';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - this.size * 1.1, 3, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield
        ctx.fillStyle = '#607D8B';
        ctx.beginPath();
        ctx.ellipse(this.x - this.size * 0.7, this.y, this.size * 0.3, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Armor lines
        ctx.strokeStyle = '#263238';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x - this.size * 0.5, this.y - this.size * 0.3 + i * 8);
            ctx.lineTo(this.x + this.size * 0.5, this.y - this.size * 0.3 + i * 8);
            ctx.stroke();
        }
    }

    drawDragon(ctx) {
        // Body (massive)
        ctx.fillStyle = '#8E24AA';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size, this.size * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#9C27B0';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - this.size * 0.6, this.size * 0.8, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#7B1FA2';
        ctx.beginPath();
        ctx.ellipse(this.x - this.size * 0.8, this.y - this.size * 0.3, this.size * 0.6, this.size * 0.4, -0.5, 0, Math.PI * 2);
        ctx.ellipse(this.x + this.size * 0.8, this.y - this.size * 0.3, this.size * 0.6, this.size * 0.4, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (glowing)
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.arc(this.x - 8, this.y - this.size * 0.6, 4, 0, Math.PI * 2);
        ctx.arc(this.x + 8, this.y - this.size * 0.6, 4, 0, Math.PI * 2);
        ctx.fill();

        // Fire breath effect
        if (Math.random() > 0.5) {
            ctx.fillStyle = '#FF9800';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(this.x + this.size + i * 8,
                    this.y - this.size * 0.6 + (Math.random() - 0.5) * 10,
                    Math.random() * 4 + 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawBoss(ctx) {
        // Massive boss body with dark armor
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.size * 1.2, this.size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boss head with crown
        ctx.fillStyle = '#2C2C2C';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.size * 0.8, this.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Crown
        ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2 / 5) - Math.PI / 2;
            const crownX = this.x + Math.cos(angle) * this.size * 0.6;
            const crownY = this.y - this.size * 0.8 + Math.sin(angle) * this.size * 0.6;
            ctx.beginPath();
            ctx.moveTo(crownX, crownY);
            ctx.lineTo(crownX + Math.cos(angle) * 8, crownY + Math.sin(angle) * 8);
            ctx.lineTo(crownX + Math.cos(angle + 0.3) * 6, crownY + Math.sin(angle + 0.3) * 6);
            ctx.closePath();
            ctx.fill();
        }

        // Glowing red eyes
        ctx.fillStyle = '#FF0000';
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x - 12, this.y - this.size * 0.8, 6, 0, Math.PI * 2);
        ctx.arc(this.x + 12, this.y - this.size * 0.8, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Dark aura effect
        ctx.strokeStyle = '#8E24AA';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
        ctx.stroke();

        // Armor details
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x - this.size, this.y - this.size * 0.5 + i * 10);
            ctx.lineTo(this.x + this.size, this.y - this.size * 0.5 + i * 10);
            ctx.stroke();
        }
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    console.log('Window loaded, starting game...');
    window.game = new Game();

    // Force first wave spawn
    setTimeout(() => {
        if (window.game && !window.game.waveInProgress) {
            console.log('Forcing first wave spawn...');
            window.game.spawnWave();
        }
    }, 1000);
});
