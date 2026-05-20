module.exports = class HashGrid {
	static stride = 1 << 16;

	cells = new Map();
	_gen = 0;

	constructor(cellSize) {
		this.cellSize = cellSize;
	}

	insert(entity, minX, minY, maxX, maxY) {
		const endX = maxX >> this.cellSize;
		const endY = maxY >> this.cellSize;
		for (let x = minX >> this.cellSize; x <= endX; x++) {
			for (let y = minY >> this.cellSize; y <= endY; y++) {
				const key = x + y * HashGrid.stride;
				const cell = this.cells.get(key);
				if (cell === undefined) {
					this.cells.set(key, [entity]);
				} else {
					cell.push(entity);
				}
			}
		}
	}

	// Callback-based query with generation stamp — zero allocations per call.
	// Each entity is visited at most once per query even if it spans multiple cells.
	query(minX, minY, maxX, maxY, callback) {
		const gen = ++this._gen;
		const endX = maxX >> this.cellSize;
		const endY = maxY >> this.cellSize;
		for (let x = minX >> this.cellSize; x <= endX; x++) {
			for (let y = minY >> this.cellSize; y <= endY; y++) {
				const key = x + y * HashGrid.stride;
				const cell = this.cells.get(key);
				if (cell !== undefined) {
					for (const entity of cell) {
						if (entity.bond) continue;
						if (entity._hgGen !== gen &&
							entity.minX < maxX && entity.maxX > minX &&
							entity.minY < maxY && entity.maxY > minY) {
							entity._hgGen = gen;
							callback(entity);
						}
					}
				}
			}
		}
	}

	clear() {
		this.cells.clear();
	}
}
