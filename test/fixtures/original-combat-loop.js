// Extracto sin cambios de GameLoop.js, commit 84797a5a0c0f344145a7b3442b02e46f13ebdb8b.
// https://github.com/aaloiamircovich/TowerDefense_Marvel/blob/84797a5a0c0f344145a7b3442b02e46f13ebdb8b/src/core/GameLoop.js
// Sólo referencia de pruebas: conserva update y handleEnemyReachedEnd originales.
export class OriginalCombatLoop {
    update(dt) {
        this.inputManager?.updateGamepad?.();
        if (this.waveManager) this.waveManager.update(dt);
        this.missionSystem?.update(dt);
        this.modeSystem?.update(dt);

        this.enemies.forEach((enemy) => {
            enemy.update(dt);
            if (enemy.hasReachedEnd && !enemy.processed) {
                this.handleEnemyReachedEnd(enemy);
            }
        });

        this.heroes.forEach((hero) => hero.update(dt, this.enemies, this.projectiles));
        this.projectiles.forEach((projectile) => projectile.update(dt));
        this.vfx.update(dt);

        let enemyWriteIndex = 0;
        for (const enemy of this.enemies) {
            if (!enemy.isAlive && !enemy.hasReachedEnd && !enemy.rewarded) {
                this.resourceManager.addCredits(enemy.reward ?? enemy.config.reward ?? 10);
                this.missionSystem?.onEnemyDefeated(enemy);
                enemy.rewarded = true;
            }
            if (enemy.isAlive && !enemy.hasReachedEnd) this.enemies[enemyWriteIndex++] = enemy;
        }
        this.enemies.length = enemyWriteIndex;

        let projectileWriteIndex = 0;
        for (const projectile of this.projectiles) {
            if (projectile.isActive) this.projectiles[projectileWriteIndex++] = projectile;
            else this.projectilePool.release(projectile);
        }
        this.projectiles.length = projectileWriteIndex;

        if (this.uiManager && this.resourceManager) {
            const currentWave = this.waveManager ? this.waveManager.currentWave : 1;
            this.uiManager.updateUI(this.resourceManager.lives, this.resourceManager.credits, currentWave, this.fps, this.stars);
            this.uiManager.updateCombatPressure?.(this.enemies, this.path, Boolean(this.waveManager?.isWaveActive));
            this.uiManager.updateSpawnQueue?.(this.waveManager?.enemiesQueue || [], this.waveManager?.spawnTimer || 0, Boolean(this.waveManager?.isWaveActive));
            this.uiManager.updateBossHud?.(this.enemies, Boolean(this.waveManager?.isWaveActive));
        }
    }

    handleEnemyReachedEnd(enemy) {
        if (!enemy || enemy.processed) return null;

        const isBoss = Boolean(enemy.isBoss || enemy.config?.isBoss);
        if (!isBoss) this.missionSystem?.handleLeak?.(enemy);
        const remainingLives = Math.max(0, Number(this.resourceManager?.lives || 0));
        const lifeLoss = isBoss ? Math.max(1, remainingLives || 1) : 1;

        this.waveManager?.recordLeak?.(enemy, { lifeLoss });
        if (isBoss) {
            this.uiManager?.showToast?.(`${enemy.name || enemy.config?.name || 'El jefe'} llego a la base: derrota inmediata`, 'danger');
            if (this.resourceManager && remainingLives > 0) this.resourceManager.removeLife(remainingLives);
            if (!this.isGameOver) this.gameOver();
        } else {
            this.resourceManager?.removeLife?.(lifeLoss);
        }

        enemy.processed = true;
        return { isBoss, lifeLoss };
    }

}
