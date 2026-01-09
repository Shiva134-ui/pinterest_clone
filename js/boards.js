const BoardSystem = {
    STORAGE_KEY: 'pinterestBoards_v1',
    DEFAULT_BOARD: 'All Pins',

    init() {
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            const initialData = {
                boards: [this.DEFAULT_BOARD],
                // Map url -> [boardName1, boardName2]
                pinMap: {}
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
        }
    },

    getData() {
        return JSON.parse(localStorage.getItem(this.STORAGE_KEY));
    },

    saveData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },

    getBoards() {
        return this.getData().boards;
    },

    createBoard(name) {
        const data = this.getData();
        if (!data.boards.includes(name)) {
            data.boards.push(name);
            this.saveData(data);
            return true;
        }
        return false;
    },

    addPinToBoard(pin, boardName) {
        // pin: { src, alt }
        const data = this.getData();
        const url = pin.src;

        if (!data.pinMap[url]) {
            data.pinMap[url] = [];
        }

        if (!data.pinMap[url].includes(boardName)) {
            data.pinMap[url].push(boardName);
            this.saveData(data);
        }
    },

    getPinsInBoard(boardName) {
        const data = this.getData();
        const pins = [];
        // This is inefficient O(N) but fine for <1000 pins
        // Ideally we'd store pins inside broads, but mapping allows 1 pin -> multiple boards
        for (const [url, boards] of Object.entries(data.pinMap)) {
            // "All Pins" contains everything
            if (boardName === this.DEFAULT_BOARD || boards.includes(boardName)) {
                pins.push({ src: url, alt: "" }); // simplified, we lose alt if not stored carefully
            }
        }
        return pins;
    },

    // Convert Cloud Pins to Local "All Pins" if not exists
    syncCloudPins(cloudPins) {
        const data = this.getData();
        let changed = false;
        cloudPins.forEach(p => {
            if (!data.pinMap[p.src]) {
                data.pinMap[p.src] = [this.DEFAULT_BOARD];
                changed = true;
            }
        });
        if (changed) this.saveData(data);
    }
};

BoardSystem.init();
