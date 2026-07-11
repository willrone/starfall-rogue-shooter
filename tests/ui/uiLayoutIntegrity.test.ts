import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(__dirname, '../../', rel), 'utf8');

const helpers = read('assets/scripts/ui/UIHelpers.ts');
const popupBase = read('assets/scripts/ui/PopupBase.ts');
const shopPopup = read('assets/scripts/ui/ShopPopup.ts');
const choicePopup = read('assets/scripts/ui/ChoicePopup.ts');
const revivePopup = read('assets/scripts/ui/RevivePopup.ts');
const settlementPopup = read('assets/scripts/ui/SettlementPopup.ts');
const equipment = read('assets/scripts/shop/equipmentManager.ts');
const game = read('assets/scripts/RogueShooterGame.ts');

function methodSlice(source: string, startNeedle: string, endNeedle: string): string {
    const start = source.indexOf(startNeedle);
    assert.ok(start >= 0, `missing method marker: ${startNeedle}`);
    const end = source.indexOf(endNeedle, start + startNeedle.length);
    assert.ok(end > start, `missing method end marker: ${endNeedle}`);
    return source.slice(start, end);
}

function testLabelsSizeTransformBeforeAddingLabel(): void {
    const body = methodSlice(helpers, 'export function makeLabel(', 'export function makeRect(');
    const transformIndex = body.indexOf('ensureUITransform(node');
    const labelIndex = body.indexOf('node.addComponent(Label)');
    assert.ok(transformIndex >= 0, 'makeLabel must size one reusable UITransform');
    assert.ok(labelIndex >= 0, 'makeLabel must still create a Label');
    assert.ok(transformIndex < labelIndex, 'UITransform must exist before Label auto-require logic runs');
    assert.doesNotMatch(body, /node\.addComponent\(UITransform\)/, 'makeLabel must not add a second UITransform after Label');
}

function testPanelLocalCoordinatesUseTopLeftLayout(): void {
    const body = methodSlice(helpers, 'export function placeLocal(', 'export function hex(');
    assert.match(body, /ph\s*\/\s*2\s*-\s*localY/, 'panel-local Y coordinates must be measured from the visual top edge');
}

function testPopupRootsHaveExplicitDesignSize(): void {
    for (const [name, source, width, height, start, end] of [
        ['ShopPopup', shopPopup, 'W', 'H', '    setup(opts: ShopPopupOptions): void {', '    render(): void {'],
        ['ChoicePopup', choicePopup, 'W', 'H', '    setup(opts: ChoiceOptions): void {', '    updateChoices('],
        ['RevivePopup', revivePopup, 'PANEL_W', 'PANEL_H', '    setup(opts: RevivePopupOptions): void {', '    private'],
        ['SettlementPopup', settlementPopup, 'W', 'H', '    setup(data: SettlementData): void {', '    private'],
    ] as const) {
        const body = methodSlice(source, start, end);
        assert.match(body, new RegExp(`ensureUITransform\\(this\\.node, ${width}, ${height}\\)`), `${name} root must have its intended UITransform size`);
    }
}

function testShopCardsExposeReadableInformationHierarchy(): void {
    assert.match(shopPopup, /'ItemMeta_' \+ index/, 'shop card needs a separate category/tier metadata label');
    assert.match(shopPopup, /'ItemName_' \+ index/, 'shop card needs a prominent item-name label');
    assert.match(shopPopup, /'ItemDesc_' \+ index/, 'shop card needs a separate effect-description label');
    assert.match(shopPopup, /'ItemPrice_' \+ index/, 'shop card needs a separate price/action label');
    assert.doesNotMatch(shopPopup, /category}\s*T.*\$\{item\.desc\}/, 'shop must not compress all item information into one SHRINK label');
}

function testChoiceCardsRenderIconAndReadableTextLayers(): void {
    assert.match(choicePopup, /getIcon\?\.\(choice\.id\)/, 'choice cards should resolve the supplied upgrade icon');
    assert.match(choicePopup, /new Node\('Icon'\)/, 'choice cards should create an icon node');
    assert.match(choicePopup, /applySlicedSprite\(bgNode, 'ui\/panels\/panel_bg_dark\/spriteFrame'\)/, 'choice popup should use the shared panel skin');
}

function testSettlementLootCardsStayInsideTheModal(): void {
    assert.match(settlementPopup, /const btnY = lootHeaderY - 58 - i \* \(btnH \+ 14\)/, 'settlement loot cards need one stable vertical pitch');
    assert.doesNotMatch(settlementPopup, /currentY = btnY - btnH - 14/, 'settlement must not apply its loot-card offset twice');
    assert.doesNotMatch(settlementPopup, /setPosition\(-\(W \/ 2 - PAD\), H \/ 2 -/, 'left-aligned settlement labels must not be shifted outside the panel');
}

function testShopRefreshesDisplayedStateAfterMutation(): void {
    assert.match(shopPopup, /getState:\s*\(\)\s*=>\s*ShopPopupState/, 'ShopPopup options need a live state provider');
    assert.match(shopPopup, /render\(\): void \{[\s\S]*this\._buildUI\(\);[\s\S]*this\._applyUiLayerDeep\(this\.node\)/, 'rerendered shop nodes must be restored to the popup UI layer');
    assert.match(shopPopup, /await this\.opts\.onBuy\(index\)[\s\S]*this\._syncFromSource\(/, 'buy should refresh visible offer/alloy state');
    assert.match(shopPopup, /await this\.opts\.onRefresh\(index\)[\s\S]*this\._syncFromSource\(/, 'refresh should refresh visible offer/alloy state');
    assert.match(equipment, /getState:\s*\(\)\s*=>/, 'equipment manager must expose current offers and alloy to the popup');
}

function testSpriteSkinsLoadAsynchronouslyWithoutNegativeCache(): void {
    const body = methodSlice(helpers, 'export function loadSprite(', '/**\n * 创建九宫格');
    assert.doesNotMatch(body, /_sfCache\[path\]\s*=\s*sf\s*\|\|\s*null/, 'missing SpriteFrames must not be cached forever');
    assert.match(helpers, /export function applySlicedSprite\([\s\S]*resources\.load\(path, SpriteFrame/, 'sprite skin helper must attach frames when async loading completes');
    assert.match(helpers, /const needsSkinChild[\s\S]*new Node\('__sliced_skin'\)/, 'Graphics-backed controls must place Sprite skin on a child node');
    assert.match(helpers, /const intendedWidth[\s\S]*target\.spriteFrame = frame[\s\S]*setContentSize\(intendedWidth, intendedHeight\)/, 'applying a SpriteFrame must preserve the node intended size');
    assert.doesNotMatch(revivePopup, /private _btn[\s\S]*const label = node\.addComponent\(Label\)/, 'revive button text must not share the Graphics node');
    assert.doesNotMatch(settlementPopup, /private _choiceBtn[\s\S]*const titleLbl = btnNode\.addComponent\(Label\)/, 'settlement choice title must not share the Graphics node');
    for (const [name, source] of [['ShopPopup', shopPopup], ['RevivePopup', revivePopup], ['SettlementPopup', settlementPopup]] as const) {
        assert.match(source, /applySlicedSprite\(/, `${name} must use the async-safe skin helper`);
    }
}

function testPopupOverlayDoesNotCreateDuplicateTransform(): void {
    const body = methodSlice(popupBase, 'static createOverlay()', 'static createDarkBg(');
    assert.ok(body.indexOf('ensureUITransform(overlay') < body.indexOf('overlay.addComponent(BlockInputEvents)'), 'overlay transform must be created before BlockInputEvents');
}

function testCombatHudMeetsMobileMinimums(): void {
    const body = methodSlice(game, 'private buildHud(', '// level panel → ChoicePopup');
    for (const expected of [
        /const HUD_H = 112/,
        /const HP_BAR_H = 24/,
        /const HP_FILL_H = 20/,
        /const XP_BAR_H = 18/,
        /const XP_FILL_H = 14/,
        /const BOT_H = 76/,
        /const hudY = DESIGN_HEIGHT - UI_SAFE_TOP - HUD_H/,
        /const BOT_Y = UI_SAFE_BOTTOM/,
        /const BTN_W = 82/,
        /const BTN_H = 68/,
    ]) {
        assert.match(body, expected, `HUD mobile sizing contract missing: ${expected}`);
    }
}

function testSettlementReturnRestoresHangarTitle(): void {
    const body = methodSlice(game, '    private openSettlementHangarActions(', '    private openSettlementLoot(');
    assert.match(body, /hangarTitleLabel\.string = '机库整备'/, 'closing settlement must restore the normal hangar title');
}

testLabelsSizeTransformBeforeAddingLabel();
testPanelLocalCoordinatesUseTopLeftLayout();
testPopupRootsHaveExplicitDesignSize();
testShopCardsExposeReadableInformationHierarchy();
testChoiceCardsRenderIconAndReadableTextLayers();
testSettlementLootCardsStayInsideTheModal();
testShopRefreshesDisplayedStateAfterMutation();
testSpriteSkinsLoadAsynchronouslyWithoutNegativeCache();
testPopupOverlayDoesNotCreateDuplicateTransform();
testCombatHudMeetsMobileMinimums();
testSettlementReturnRestoresHangarTitle();

console.log('uiLayoutIntegrity tests passed.');
