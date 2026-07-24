import { global } from "./global.js";
import { util } from "./util.js";

class TankEditor {
    constructor() {
        this.active = false;
        this.slideProgress = 0; // 0 = hidden, 1 = fully open
        this.selectedLayerIndex = 0;
        this.selectedItemIndex = 0; // 0 = Body
        this.openDropdown = null;
        
        // Exact tanks.js default starting settings: Basic Tank (Length 18, Width 8)
        this.tankData = {
            classId: "basic",
            displayName: "Basic",
            danger: 1,
            body: {
                sides: 0, // 0 = circle
                size: 12,
                color: "blue"
            },
            layers: [
                {
                    name: "LAYER 1",
                    collapsed: false,
                    items: [
                        { id: "body", name: "Body", type: "body", sides: 0, size: 12, color: "blue" },
                        { 
                            id: "gun_1", 
                            name: "Front Barrel", 
                            type: "gun", 
                            length: 18, 
                            width: 8, 
                            aspect: 0, 
                            x: 0, 
                            y: 0, 
                            angle: 0, 
                            color: "grey",
                            invisible: false,
                            reloadMult: 1.0,
                            spray: 1.0,
                            bulletType: "bullet"
                        }
                    ]
                }
            ]
        };

        // Colors list featuring dynamic team color
        this.colors = ["grey", "team", "blue", "red", "green", "yellow", "purple", "cyan", "darkGrey"];
        this.bulletTypes = ["bullet", "drone", "swarm", "trap", "undertow", "missile", "healer", "sunchip", "minion"];
        this.clickables = [];
        this.hoverTooltips = [];
        this.dropdownMenuOverlays = [];

        // Initial sync of compiled mockup
        this.syncPlayerEntity();
    }

    toggle() {
        this.active = !this.active;
        global.showTankEditor = this.active;
        global.createMessage(this.active ? "Entered Tank Editor (Press ; to exit)." : "Exited Tank Editor.", 3000);
        if (!this.active && global.canvas) {
            global.canvas.title = "";
        }
        this.openDropdown = null;
    }

    getSelectedItem() {
        if (!this.tankData.layers[this.selectedLayerIndex]) return null;
        return this.tankData.layers[this.selectedLayerIndex].items[this.selectedItemIndex] || null;
    }

    addItem(type) {
        const layer = this.tankData.layers[this.selectedLayerIndex] || this.tankData.layers[0];
        layer.collapsed = false; // Expand layer when adding an item
        const count = layer.items.length + 1;
        if (type === 'gun') {
            layer.items.push({
                id: `gun_${Date.now()}`,
                name: `Gun ${count}`,
                type: "gun",
                length: 18,
                width: 8,
                aspect: 0,
                x: 0,
                y: 0,
                angle: 0,
                color: "grey",
                invisible: false,
                reloadMult: 1.0,
                spray: 1.0,
                bulletType: "bullet"
            });
        } else if (type === 'decor') {
            layer.items.push({
                id: `decor_${Date.now()}`,
                name: `Decor ${count}`,
                type: "decor",
                shape: "cross",
                size: 8,
                color: "red"
            });
        }
        this.selectedItemIndex = layer.items.length - 1;
        this.syncPlayerEntity();
    }

    addLayer() {
        const num = this.tankData.layers.length + 1;
        this.tankData.layers.push({
            name: `LAYER ${num}`,
            collapsed: false,
            items: []
        });
        this.selectedLayerIndex = this.tankData.layers.length - 1;
        this.selectedItemIndex = 0;
        this.syncPlayerEntity();
    }

    toggleInvisible(item) {
        item.invisible = !item.invisible;
        global.createMessage(`Turret visibility: ${item.invisible ? 'Invisible' : 'Visible'}`, 2500);
        this.syncPlayerEntity();
    }

    editClassId() {
        const input = prompt("Enter internal Class Identifier (letters only, no spaces or punctuation):", this.tankData.classId);
        if (input !== null) {
            const sanitized = input.replace(/[^a-zA-Z]/g, '').toLowerCase();
            if (sanitized.length > 0) {
                this.tankData.classId = sanitized;
                global.createMessage(`Class ID set to: Class.${sanitized}`, 3000);
            } else {
                alert("Class Identifier must contain at least one letter!");
            }
        }
    }

    editDisplayName() {
        const input = prompt("Enter Tank Display Name:", this.tankData.displayName);
        if (input !== null && input.trim().length > 0) {
            this.tankData.displayName = input.trim();
            global.createMessage(`Display Name set to: "${this.tankData.displayName}"`, 3000);
        }
    }

    // Robust mockup compilation matching server gun.js math & dynamic team colors
    syncPlayerEntity(instance) {
        if (!this.tankData) return;

        const gunItems = [];
        this.tankData.layers.forEach(layer => {
            layer.items.forEach(item => {
                if (item.type === 'gun') gunItems.push(item);
            });
        });

        // Format color into full Arras tuple format ("team" -> "mirror 0 1 0 false")
        const formatColor = (c) => {
            if (!c || c === 'team') return 'mirror 0 1 0 false';
            if (typeof c === 'string' && !c.includes(' ')) return `${c} 0 1 0 false`;
            return c;
        };

        // Convert tanks.js units to mockup dimensions (/ 10 factor)
        const gunsConfigList = gunItems.map(g => ({
            color: formatColor(g.color),
            alpha: g.invisible ? 0 : 1,
            strokeWidth: 1,
            borderless: false,
            drawFill: !g.invisible,
            drawAbove: false,
            length: (g.length || 18) / 10,
            width: (g.width || 8) / 10,
            aspect: g.aspect || 0,
            angle: (g.angle || 0) * Math.PI / 180,
            direction: 0,
            offset: (g.x || 0) / 10,
            layer: 0,
        }));

        // Construct complete mockup structure matching tanks.js calculations
        global.tankEditorMockup = {
            shape: this.tankData.body.sides || 0,
            size: this.tankData.body.size || 12,
            realSize: this.tankData.body.size || 12,
            color: formatColor(this.tankData.body.color),
            strokeWidth: 1,
            facing: 0,
            glow: null,
            guns: gunsConfigList,
            gunsObj: {
                length: gunsConfigList.length,
                getPositions: () => Array(gunsConfigList.length).fill(0),
                getConfig: () => gunsConfigList,
                update: () => {}
            },
            turrets: [],
            props: [],
            position: {
                axis: (this.tankData.body.size || 12) * 2,
                middle: { x: 0, y: 0 }
            }
        };

        if (instance) {
            instance.shape = this.tankData.body.sides || 0;
            instance.size = this.tankData.body.size || 12;
            instance.color = formatColor(this.tankData.body.color);
        }
    }

    exportJS() {
        const itemToGun = (item) => {
            const shootSettings = [];
            shootSettings.push("g.basic");
            if (item.reloadMult !== undefined && item.reloadMult !== 1.0) {
                shootSettings.push(`{ reload: ${item.reloadMult} }`);
            }
            if (item.spray !== undefined && item.spray !== 1.0) {
                shootSettings.push(`{ spray: ${item.spray} }`);
            }

            const colorProp = item.color && item.color !== 'grey' ? `,\n                COLOR: '${item.color}'` : '';

            return `        {
            POSITION: {
                LENGTH: ${item.length},
                WIDTH: ${item.width}${item.aspect ? `, ASPECT: ${item.aspect}` : ''}${item.x ? `, X: ${item.x}` : ''}${item.y ? `, Y: ${item.y}` : ''}${item.angle ? `, ANGLE: ${item.angle}` : ''}
            },
            PROPERTIES: {
                SHOOT_SETTINGS: combineStats([${shootSettings.join(', ')}]),
                TYPE: '${item.bulletType || 'bullet'}'${colorProp}${item.invisible ? ',\n                DRAW_FILL: false' : ''}
            }
        }`;
        };

        const guns = [];
        this.tankData.layers.forEach(layer => {
            layer.items.forEach(item => {
                if (item.type === 'gun') {
                    guns.push(itemToGun(item));
                }
            });
        });

        const jsCode = `// Exported Tank Definition matching tanks.js calculations
Class.${this.tankData.classId} = {
    PARENT: 'genericTank',
    LABEL: "${this.tankData.displayName}",
    DANGER: ${this.tankData.danger},
    BODY: {
        SIZE: ${this.tankData.body.size}
    },
    GUNS: [
${guns.join(',\n')}
    ]
};`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsCode);
            global.createMessage("Tank JS Definition copied to clipboard!", 4000);
        } else {
            console.log("Exported JS Code:\n" + jsCode);
            global.createMessage("Tank JS Definition logged to console!", 4000);
        }
    }

    render(ctx, screenWidth, screenHeight) {
        // Smooth sliding animation
        this.slideProgress = util.lerp(this.slideProgress, this.active ? 1 : 0, 0.15);

        if (this.slideProgress < 0.005) {
            this.clickables = [];
            this.hoverTooltips = [];
            this.dropdownMenuOverlays = [];
            if (global.canvas && global.canvas.title) global.canvas.title = "";
            return;
        }

        // Detect screen resolution directly from canvas
        const canvasW = ctx.canvas.width;
        const canvasH = ctx.canvas.height;
        const scale = canvasW / (window.innerWidth || 1);

        this.clickables = [];
        this.hoverTooltips = [];
        this.dropdownMenuOverlays = [];

        const leftWidth = 310 * scale;
        const rightWidth = 310 * scale;

        // Slide positions: Flush against left (x=0) and right (x=canvasW-rightWidth)
        const leftX = -leftWidth + leftWidth * this.slideProgress;
        const rightX = canvasW - rightWidth * this.slideProgress;

        // Left Panel Overlay (Flush to left screen border, 100% full height)
        ctx.fillStyle = "rgba(30, 32, 40, 0.94)";
        ctx.fillRect(leftX, 0, leftWidth, canvasH);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(leftX, 0, leftWidth, canvasH);

        const selectedItem = this.getSelectedItem();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(18 * scale)}px Ubuntu, sans-serif`;
        ctx.fillText(`Selected: ${selectedItem ? selectedItem.name : 'None'}`, leftX + 20 * scale, 40 * scale);

        ctx.font = `${Math.round(14 * scale)}px Ubuntu, sans-serif`;
        let yPos = 75 * scale;
        const rowGap = 36 * scale;

        if (selectedItem) {
            if (selectedItem.type === "body") {
                this.renderEditableNumberRow(ctx, scale, "Sides", selectedItem.sides, leftX + 20 * scale, yPos, (val) => {
                    selectedItem.sides = Math.max(0, Math.round(val));
                    this.tankData.body.sides = selectedItem.sides;
                });
                yPos += rowGap;
                this.renderEditableNumberRow(ctx, scale, "Size", selectedItem.size, leftX + 20 * scale, yPos, (val) => {
                    selectedItem.size = Math.max(1, val);
                    this.tankData.body.size = selectedItem.size;
                });
                yPos += rowGap;
                this.renderDropdownRow(ctx, scale, "Color", selectedItem.color || "blue", this.colors, leftX + 20 * scale, yPos, (selectedColor) => {
                    selectedItem.color = selectedColor;
                    this.tankData.body.color = selectedColor;
                });
            } else if (selectedItem.type === "gun") {
                this.renderEditableNumberRow(ctx, scale, "Length", selectedItem.length, leftX + 20 * scale, yPos, (val) => { selectedItem.length = val; });
                yPos += rowGap;
                this.renderEditableNumberRow(ctx, scale, "Width", selectedItem.width, leftX + 20 * scale, yPos, (val) => { selectedItem.width = val; });
                yPos += rowGap;
                this.renderEditableNumberRow(ctx, scale, "Angle", selectedItem.angle, leftX + 20 * scale, yPos, (val) => { selectedItem.angle = val; });
                yPos += rowGap;
                this.renderEditableNumberRow(ctx, scale, "Aspect", selectedItem.aspect, leftX + 20 * scale, yPos, (val) => { selectedItem.aspect = val; });
                yPos += rowGap;
                this.renderEditableNumberRow(ctx, scale, "X Offset", selectedItem.x || 0, leftX + 20 * scale, yPos, (val) => { selectedItem.x = val; });
                yPos += rowGap;
                this.renderEditableNumberRow(ctx, scale, "Y Offset", selectedItem.y || 0, leftX + 20 * scale, yPos, (val) => { selectedItem.y = val; });
                yPos += rowGap;

                // Color Dropdown
                this.renderDropdownRow(ctx, scale, "Color", selectedItem.color || "grey", this.colors, leftX + 20 * scale, yPos, (selectedColor) => {
                    selectedItem.color = selectedColor;
                });
                yPos += rowGap;

                // Invisible Toggle
                ctx.fillText(`Invisible: ${selectedItem.invisible ? 'YES' : 'NO'}`, leftX + 20 * scale, yPos);
                this.renderButton(ctx, scale, "Toggle", leftX + 160 * scale, yPos - 16 * scale, 125 * scale, 24 * scale, selectedItem.invisible ? "#d9534f" : "#5cb85c", "#ffffff", () => this.toggleInvisible(selectedItem));
                yPos += rowGap;

                // Linear Reload Mult
                const reloadVal = Math.round((selectedItem.reloadMult || 1.0) * 10) / 10;
                this.renderEditableNumberRow(ctx, scale, "Reload", reloadVal, leftX + 20 * scale, yPos, (val) => {
                    selectedItem.reloadMult = Math.max(0.1, val);
                }, "Linear scale from unupgraded (0 pts) to maxed (9 pts).");
                yPos += rowGap;

                // Spray
                const sprayVal = Math.round((selectedItem.spray || 1.0) * 10) / 10;
                this.renderEditableNumberRow(ctx, scale, "Spray", sprayVal, leftX + 20 * scale, yPos, (val) => {
                    selectedItem.spray = Math.max(0, val);
                }, "Bullet spread. High spray (e.g. Diesel) spreads wider, low spray (e.g. Assassin) fires straight.");
                yPos += rowGap;

                // In-game Bullet Type Dropdown Menu
                this.renderDropdownRow(ctx, scale, "Type", selectedItem.bulletType || "bullet", this.bulletTypes, leftX + 20 * scale, yPos, (selectedType) => {
                    selectedItem.bulletType = selectedType;
                });
            } else if (selectedItem.type === "decor") {
                this.renderEditableNumberRow(ctx, scale, "Size", selectedItem.size, leftX + 20 * scale, yPos, (val) => { selectedItem.size = Math.max(1, val); });
                yPos += rowGap;
                this.renderDropdownRow(ctx, scale, "Color", selectedItem.color || "red", this.colors, leftX + 20 * scale, yPos, (selectedColor) => {
                    selectedItem.color = selectedColor;
                });
            }
        }

        // Right Panel Overlay (Flush to right screen border, 100% full height)
        ctx.fillStyle = "rgba(30, 32, 40, 0.94)";
        ctx.fillRect(rightX, 0, rightWidth, canvasH);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 2 * scale;
        ctx.strokeRect(rightX, 0, rightWidth, canvasH);

        // Header Buttons
        this.renderButton(ctx, scale, "[ EXIT EDITOR ]", rightX + 20 * scale, 25 * scale, 270 * scale, 35 * scale, "#d9534f", "#ffffff", () => this.toggle());
        this.renderButton(ctx, scale, "[ EXPORT JS ]", rightX + 20 * scale, 70 * scale, 270 * scale, 35 * scale, "#5cb85c", "#ffffff", () => this.exportJS());

        // Metadata: Dual Tank Names & Danger
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(15 * scale)}px Ubuntu, sans-serif`;

        // 1. Class ID (Internal Identifier) with Browser Native Tooltip
        const classIdLabelX = rightX + 20 * scale;
        const classIdLabelY = 135 * scale;
        ctx.fillText(`Class ID: ${this.tankData.classId}`, classIdLabelX, classIdLabelY);
        this.renderButton(ctx, scale, "[ Edit ]", rightX + 220 * scale, classIdLabelY - 16 * scale, 70 * scale, 24 * scale, "#444455", "#ffffff", () => this.editClassId());
        this.registerTooltipArea(classIdLabelX, classIdLabelY - 16 * scale, 190 * scale, 24 * scale, "Must be letters only, no spaces or punctuation.");

        // 2. Display Name
        const nameLabelY = 175 * scale;
        ctx.fillText(`Name: ${this.tankData.displayName}`, rightX + 20 * scale, nameLabelY);
        this.renderButton(ctx, scale, "[ Edit ]", rightX + 220 * scale, nameLabelY - 16 * scale, 70 * scale, 24 * scale, "#444455", "#ffffff", () => this.editDisplayName());

        // 3. Danger with Editable Textbox
        const dangerLabelY = 215 * scale;
        this.renderEditableNumberRow(ctx, scale, "Danger", this.tankData.danger, rightX + 20 * scale, dangerLabelY, (val) => {
            this.tankData.danger = Math.max(1, Math.round(val));
        }, "3 is weak, 5 is medium, 7 is dangerous.");

        // Construction Layers Tree (Collapsible Dropdown Drop-downish style)
        ctx.font = `bold ${Math.round(18 * scale)}px Ubuntu, sans-serif`;
        ctx.fillText("Construction:", rightX + 20 * scale, 260 * scale);

        let layerY = 290 * scale;
        ctx.font = `${Math.round(15 * scale)}px monospace`;

        this.tankData.layers.forEach((layer, lIdx) => {
            const isLayerSelected = (lIdx === this.selectedLayerIndex);
            ctx.fillStyle = isLayerSelected ? "#5bc0de" : "#ffffff";

            // Collapsible Layer Header (Shows LAYER X v when expanded, LAYER X > when collapsed)
            const arrow = layer.collapsed ? " >" : " v";
            const layerText = layer.name + arrow;

            this.renderClickableArea(rightX + 20 * scale, layerY - 14 * scale, 270 * scale, 22 * scale, () => {
                layer.collapsed = !layer.collapsed;
                this.selectedLayerIndex = lIdx;
                this.selectedItemIndex = 0;
            });
            ctx.fillText(layerText, rightX + 20 * scale, layerY);
            layerY += 24 * scale;

            // Render children items only if NOT collapsed!
            if (!layer.collapsed) {
                layer.items.forEach((item, iIdx) => {
                    const isSelected = (lIdx === this.selectedLayerIndex && iIdx === this.selectedItemIndex);
                    ctx.fillStyle = isSelected ? "#5cb85c" : "#aaaaaa";
                    const itemText = `  ${item.name}`;

                    this.renderClickableArea(rightX + 20 * scale, layerY - 14 * scale, 270 * scale, 20 * scale, () => {
                        this.selectedLayerIndex = lIdx;
                        this.selectedItemIndex = iIdx;
                    });
                    ctx.fillText(itemText, rightX + 20 * scale, layerY);
                    layerY += 22 * scale;
                });
                layerY += 10 * scale;
            }
        });

        // Add controls at bottom of right panel
        this.renderButton(ctx, scale, "+ Add Gun", rightX + 20 * scale, canvasH - 95 * scale, 130 * scale, 32 * scale, "#444455", "#ffffff", () => this.addItem("gun"));
        this.renderButton(ctx, scale, "+ Add Decor", rightX + 160 * scale, canvasH - 95 * scale, 130 * scale, 32 * scale, "#444455", "#ffffff", () => this.addItem("decor"));
        this.renderButton(ctx, scale, "+ Add Layer", rightX + 20 * scale, canvasH - 50 * scale, 270 * scale, 32 * scale, "#444455", "#ffffff", () => this.addLayer());

        // Top center hint banner
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(canvasW / 2 - 125 * scale, 15 * scale, 250 * scale, 30 * scale);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(14 * scale)}px Ubuntu, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("Press ; to toggle Editor", canvasW / 2, 35 * scale);
        ctx.textAlign = "left";

        // Render floating dropdown menus ON TOP of everything
        this.renderDropdownOverlays(ctx, scale);

        // Update Native Browser Tooltip
        this.updateNativeBrowserTooltip(scale);
    }

    renderEditableNumberRow(ctx, scale, label, value, x, y, onUpdate, tooltipText) {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${label}:`, x, y);

        const inputX = x + 120 * scale;
        const inputY = y - 16 * scale;
        const inputW = 70 * scale;
        const inputH = 24 * scale;

        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(inputX, inputY, inputW, inputH);
        ctx.strokeStyle = "rgba(92, 184, 92, 0.8)";
        ctx.lineWidth = 1.5 * scale;
        ctx.strokeRect(inputX, inputY, inputW, inputH);

        ctx.fillStyle = "#5cb85c";
        ctx.font = `bold ${Math.round(13 * scale)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), inputX + inputW / 2, inputY + inputH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        this.renderClickableArea(inputX, inputY, inputW, inputH, () => {
            const valStr = prompt(`Enter numeric value for ${label}:`, value);
            if (valStr !== null && valStr.trim().length > 0) {
                const num = parseFloat(valStr);
                if (!isNaN(num)) {
                    onUpdate(num);
                    this.syncPlayerEntity();
                } else {
                    alert("Please enter a valid number!");
                }
            }
        });

        if (tooltipText) {
            this.registerTooltipArea(x, y - 16 * scale, 200 * scale, 24 * scale, tooltipText);
        }
    }

    renderDropdownRow(ctx, scale, label, currentValue, options, x, y, onSelect) {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${label}:`, x, y);

        const dropX = x + 120 * scale;
        const dropY = y - 16 * scale;
        const dropW = 145 * scale;
        const dropH = 24 * scale;

        const isOpen = this.openDropdown === label;

        ctx.fillStyle = isOpen ? "#337ab7" : "#444455";
        ctx.fillRect(dropX, dropY, dropW, dropH);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = 1.5 * scale;
        ctx.strokeRect(dropX, dropY, dropW, dropH);

        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(12 * scale)}px Ubuntu, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${currentValue} ${isOpen ? '▲' : '▼'}`, dropX + dropW / 2, dropY + dropH / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        this.renderClickableArea(dropX, dropY, dropW, dropH, () => {
            this.openDropdown = isOpen ? null : label;
        });

        if (isOpen) {
            this.dropdownMenuOverlays.push({
                dropX,
                dropY,
                dropW,
                dropH,
                currentValue,
                options,
                onSelect
            });
        }
    }

    renderDropdownOverlays(ctx, scale) {
        for (let menu of this.dropdownMenuOverlays) {
            const { dropX, dropY, dropW, dropH, currentValue, options, onSelect } = menu;
            options.forEach((opt, idx) => {
                const optY = dropY + (idx + 1) * dropH;
                ctx.fillStyle = opt === currentValue ? "#5cb85c" : "#222233";
                ctx.fillRect(dropX, optY, dropW, dropH);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                ctx.strokeRect(dropX, optY, dropW, dropH);

                ctx.fillStyle = "#ffffff";
                ctx.font = `${Math.round(12 * scale)}px Ubuntu, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(opt, dropX + dropW / 2, optY + dropH / 2);
                ctx.textAlign = "left";
                ctx.textBaseline = "alphabetic";

                this.renderClickableArea(dropX, optY, dropW, dropH, () => {
                    onSelect(opt);
                    this.openDropdown = null;
                    this.syncPlayerEntity();
                });
            });
        }
    }

    renderButton(ctx, scale, text, x, y, w, h, bgColor, textColor, onClick) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1.5 * scale;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(13 * scale)}px Ubuntu, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, x + w / 2, y + h / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Register exact hitbox for clicking
        this.clickables.push({ x, y, w, h, onClick });
    }

    renderClickableArea(x, y, w, h, onClick) {
        this.clickables.push({ x, y, w, h, onClick });
    }

    registerTooltipArea(x, y, w, h, text) {
        this.hoverTooltips.push({ x, y, w, h, text });
    }

    updateNativeBrowserTooltip(scale) {
        if (!global.mousePos || !global.canvas) return;
        const mx = global.mousePos.x * scale;
        const my = global.mousePos.y * scale;

        let activeTooltipText = "";
        for (let tip of this.hoverTooltips) {
            if (mx >= tip.x && mx <= tip.x + tip.w && my >= tip.y && my <= tip.y + tip.h) {
                activeTooltipText = tip.text;
                break;
            }
        }

        if (global.canvas.title !== activeTooltipText) {
            global.canvas.title = activeTooltipText;
        }
    }

    handleClick(x, y) {
        if (this.slideProgress < 0.2) return false;

        const scale = (global.canvas ? global.canvas.width : window.innerWidth) / (window.innerWidth || 1);
        const scaledX = x * scale;
        const scaledY = y * scale;

        for (let btn of this.clickables) {
            if (scaledX >= btn.x && scaledX <= btn.x + btn.w && scaledY >= btn.y && scaledY <= btn.y + btn.h) {
                btn.onClick();
                return true;
            }
        }

        return false;
    }
}

const tankEditor = new TankEditor();
global.tankEditor = tankEditor;
global.toggleTankEditor = () => tankEditor.toggle();

export { tankEditor };
