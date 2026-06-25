import {
    Node,
    Label,
    Graphics,
} from 'cc';

export interface ButtonView {
    node: Node;
    gfx: Graphics;
    label: Label;
    width: number;
    height: number;
    color: string;
    disabledColor: string;
    disabled: boolean;
}

export class PanelManager {
    // HUD elements
    titleLabel: Label | null = null;
    timerLabel: Label | null = null;
    statLabel: Label | null = null;
    equipmentLabel: Label | null = null;
    debugLabel: Label | null = null;
    toastLabel: Label | null = null;
    hpBar: Graphics | null = null;
    xpBar: Graphics | null = null;

    // Menu panel
    menuPanel: Node | null = null;
    menuPanelShadow: Node | null = null;

    // Loading panel
    loadingPanel: Node | null = null;
    loadingTitleLabel: Label | null = null;
    loadingProgressLabel: Label | null = null;

    // Pause panel
    pausePanel: Node | null = null;
    pausePanelShadow: Node | null = null;

    // Settings panel
    settingsPanel: Node | null = null;
    settingsPanelShadow: Node | null = null;
    settingsBodyLabel: Label | null = null;
    bgmToggleButton: ButtonView | null = null;
    sfxToggleButton: ButtonView | null = null;

    // Info panel
    infoPanel: Node | null = null;
    infoPanelShadow: Node | null = null;
    infoTitleLabel: Label | null = null;
    infoBodyLabel: Label | null = null;

    // Level panel
    levelPanel: Node | null = null;
    levelPanelShadow: Node | null = null;
    levelTitleLabel: Label | null = null;
    levelHintLabel: Label | null = null;
    levelChoiceButtons: ButtonView[] = [];
    levelBackButton: ButtonView | null = null;
    levelRefreshButton: ButtonView | null = null;

    // Shop panel
    shopPanel: Node | null = null;
    shopPanelShadow: Node | null = null;
    shopTitleLabel: Label | null = null;
    shopTipLabel: Label | null = null;
    shopButtons: ButtonView[] = [];
    shopSlotRefreshButtons: ButtonView[] = [];
    shopCloseButton: ButtonView | null = null;

    // Hangar panel
    hangarPanel: Node | null = null;
    hangarPanelShadow: Node | null = null;
    hangarTitleLabel: Label | null = null;
    hangarStatsLabel: Label | null = null;
    hangarTipLabel: Label | null = null;
    lootButtons: ButtonView[] = [];
    equipmentButtons: ButtonView[] = [];
    equippedButtons: ButtonView[] = [];
    switchWeaponButton: ButtonView | null = null;
    shopButton: ButtonView | null = null;
    extractButton: ButtonView | null = null;
    pauseButton: ButtonView | null = null;
    hangarBackButton: ButtonView | null = null;
    prevEquipmentButton: ButtonView | null = null;
    nextEquipmentButton: ButtonView | null = null;
    equipActionButton: ButtonView | null = null;
    upgradeActionButton: ButtonView | null = null;
    equipmentDetailLabel: Label | null = null;
    startButton: ButtonView | null = null;

    /** Hide all overlay panels (menu, pause, settings, info, level, shop, hangar). */
    hideAllOverlays(): void {
        this.setMenuPanelActive(false);
        if (this.pausePanel) this.pausePanel.active = false;
        if (this.pausePanelShadow) this.pausePanelShadow.active = false;
        if (this.settingsPanel) this.settingsPanel.active = false;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = false;
        if (this.infoPanel) this.infoPanel.active = false;
        if (this.infoPanelShadow) this.infoPanelShadow.active = false;
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
        this.setShopPanelActive(false);
        if (this.hangarPanel) this.hangarPanel.active = false;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = false;
    }

    // --- Menu panel ---

    setMenuPanelActive(active: boolean): void {
        if (this.menuPanel) this.menuPanel.active = active;
        if (this.menuPanelShadow) this.menuPanelShadow.active = active;
    }

    showMenuPanel(): void {
        this.setMenuPanelActive(true);
    }

    hideMenuPanel(): void {
        this.setMenuPanelActive(false);
    }

    // --- Shop panel ---

    setShopPanelActive(active: boolean): void {
        if (this.shopPanel) this.shopPanel.active = active;
        if (this.shopPanelShadow) this.shopPanelShadow.active = active;
    }

    showShopPanel(): void {
        this.setShopPanelActive(true);
    }

    hideShopPanel(): void {
        this.setShopPanelActive(false);
    }

    // --- Pause panel ---

    showPausePanel(): void {
        if (this.pausePanel) this.pausePanel.active = true;
        if (this.pausePanelShadow) this.pausePanelShadow.active = true;
    }

    hidePausePanel(): void {
        if (this.pausePanel) this.pausePanel.active = false;
        if (this.pausePanelShadow) this.pausePanelShadow.active = false;
    }

    // --- Settings panel ---

    showSettingsPanel(): void {
        if (this.settingsPanel) this.settingsPanel.active = true;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = true;
    }

    hideSettingsPanel(): void {
        if (this.settingsPanel) this.settingsPanel.active = false;
        if (this.settingsPanelShadow) this.settingsPanelShadow.active = false;
    }

    // --- Info panel ---

    showInfoPanel(): void {
        if (this.infoPanel) this.infoPanel.active = true;
        if (this.infoPanelShadow) this.infoPanelShadow.active = true;
    }

    hideInfoPanel(): void {
        if (this.infoPanel) this.infoPanel.active = false;
        if (this.infoPanelShadow) this.infoPanelShadow.active = false;
    }

    // --- Level panel ---

    showLevelPanel(): void {
        if (this.levelPanel) this.levelPanel.active = true;
        if (this.levelPanelShadow) this.levelPanelShadow.active = true;
    }

    hideLevelPanel(): void {
        if (this.levelPanel) this.levelPanel.active = false;
        if (this.levelPanelShadow) this.levelPanelShadow.active = false;
    }

    // --- Hangar panel ---

    showHangarPanel(): void {
        if (this.hangarPanel) this.hangarPanel.active = true;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = true;
    }

    hideHangarPanel(): void {
        if (this.hangarPanel) this.hangarPanel.active = false;
        if (this.hangarPanelShadow) this.hangarPanelShadow.active = false;
    }

    // --- Loading panel ---

    showLoadingPanel(): void {
        if (this.loadingPanel) this.loadingPanel.active = true;
    }

    hideLoadingPanel(): void {
        if (this.loadingPanel) this.loadingPanel.active = false;
    }

    // --- Combat HUD controls visibility ---

    setCombatHudControlsActive(active: boolean): void {
        if (this.switchWeaponButton) this.switchWeaponButton.node.active = active;
        if (this.shopButton) this.shopButton.node.active = active;
        if (this.extractButton) this.extractButton.node.active = active;
        if (this.pauseButton) this.pauseButton.node.active = active;
    }

    // --- Hangar controls visibility ---

    setHangarControlsActive(active: boolean): void {
        this.equippedButtons.forEach((button) => button.node.active = active);
        this.equipmentButtons.forEach((button) => button.node.active = active);
        if (this.prevEquipmentButton) this.prevEquipmentButton.node.active = active;
        if (this.nextEquipmentButton) this.nextEquipmentButton.node.active = active;
        if (this.equipActionButton) this.equipActionButton.node.active = active;
        if (this.upgradeActionButton) this.upgradeActionButton.node.active = active;
        if (this.hangarBackButton) this.hangarBackButton.node.active = active;
        if (this.equipmentDetailLabel) this.equipmentDetailLabel.node.active = active;
    }

    // --- Loading progress ---

    setLoadingProgress(message: string): void {
        if (this.loadingProgressLabel) this.loadingProgressLabel.string = message;
    }
}
