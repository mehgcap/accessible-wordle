'use strict';

let a11yFix = () => {

let setAttribute = (elem, attr, value) => {
    elem.setAttribute(attr, value);
}

let shadowQuery = (elem, query) => {
	let root = elem.shadowRoot;
	return !root ? null : root.querySelector(query);
};

let shadowQueryAll = (elem, query) => {
	let root = elem.shadowRoot;
	return !root ? [] : root.querySelectorAll(query);
};

let getElementByClassStart = (classString, root=null) => {
	let searchRoot = root ? root : document;
	let queryString = '[class^=\"' + classString + '\"]';
	return searchRoot.querySelector(queryString);
};

let getElementsByClassStart = (classString, root=null) => {
	let searchRoot = root ? root : document;
	let queryString = '[class^=\"' + classString + '\"]';
	return searchRoot.querySelectorAll(queryString);
};

let fix = (elem, makeClickable, role, label) => {
	if (role) {
		if (role == 'tile') {
			setAttribute(elem, 'role', 'img');
			setAttribute(elem, 'aria-roledescription', 'tile');
		} else {
			setAttribute(elem, 'role', role);
		}
		if (role == 'dialog') {
			setAttribute(elem, 'aria-modal', false);
		}
	}

	if (label) {
		setAttribute(elem, 'aria-label', label);
	}

	if (makeClickable) {
		if (elem.tabIndex == 0)
			return;

		elem.tabIndex = 0;
		elem.addEventListener('keydown', (e) => {
			if (e.code == 'Enter' || e.code == 'Space') {
				e.stopPropagation();
				e.preventDefault();
				let switchChild = shadowQuery(elem, 'div.switch');
				if (switchChild) {
					switchChild.click();
				} else {
					elem.click();
				}
			}
		}, false);
	}
}

let masterFixer = (elem) => {
	let newLabel = '';
	['letter', 'evaluation', 'data-key'].forEach(attr => {
		let value = elem.getAttribute(attr);
		if (value) {
			newLabel += ' ' + value;
		}
	});
	if (newLabel != elem.getAttribute('aria-label')) {
		setAttribute(elem, 'aria-label', newLabel);
    }
};

let createGameBoard = function() {
	let board = getElementByClassStart("Board-module_board_");
	if(!board) {
		console.log("Could not find the game board element.");
		alert("Could not find the game board element. This script won't work properly, as something must have changed in Wordle's code.");
		return;
	}
	//turn the board into a table
	setAttribute(board, "role", "table");
	let rows = getElementsByClassStart("Row-module_row_");
	if(!rows) {
		console.log("Could not find any rows.");
		return;
	}
	rows.forEach(elem => {
		setAttribute(elem, "role", "row");
	});
	let cells = getElementsByClassStart("Tile-module_tile_");
	if(!cells) {
		console.log("Could not find any tiles.");
		return;
	}
	cells.forEach(elem => {
		//set the label to the letter and the state (correct, empty, absent, etc)
		updateTileLabel(elem);
		let newSpan = document.createElement("span");
		newSpan.innerText = elem.getAttribute("aria-label");
		//elem.parentElement.appendChild(newSpan);
		//give the parent div of this cell, which is empty, the same label as the cell
		setAttribute(elem.parentElement, "aria-label", elem.getAttribute("aria-label"));
		setAttribute(elem.parentElement, "role", "cell");
		setAttribute(elem, 'aria-live', 'polite');
	});
};

let updateTileLabel = function(tile) {
	let letter = tile.innerText ? tile.innerText.substring(0, 1) : null;
	let status = tile.getAttribute("data-state");
	//this results in something like "S absent"
	let label = letter ? `${letter} ${status}` : "Blank";
	//setAttribute(tile, "aria-label", label);
	tile.innerText = label;
};

let masterObserver = new MutationObserver((mutationsList, observer) => {
	for (let mutation of mutationsList) {
		masterFixer(mutation.target);
	}
});

let watchKey = (key) => {
    masterObserver.observe(key, { attributes: true });
}

let checkboxObserver = new MutationObserver((mutationsList, observer) => {
	for (let mutation of mutationsList) {
		let checkbox = mutation.target;
		let newAttr = '' + checkbox.hasAttribute('checked');
		if (newAttr != checkbox.getAttribute('aria-checked')) {
			setAttribute(checkbox, 'aria-checked', newAttr);
		}
	}
});

let watchCheckbox = (checkbox) => {
	if (!checkbox.hasAttribute('aria-checked')) {
		fix(checkbox, true, 'checkbox', checkbox.getAttribute('name'));
		setAttribute(checkbox, 'aria-checked',
		checkbox.hasAttribute('checked'));
	}
	checkboxObserver.observe(checkbox, { attributes: true });
};

let gamePageObserver = new MutationObserver((mutationsList, observer) => {
	let appModule = getElementByClassStart("app-module_game__");
	console.log('GamePage changed.');
	setTimeout(() => {
		//if this is ever set to true, we will try to fix and then focus on a close button
		let fixCloseButton = false;
		mutationsList.forEach((mutation) => {
			//if the child list changed, see about toasts or modal dialogs
			if(mutation.type == "childList") {
				//set up a toast if one was added
				let toasters = getElementsByClassStart("Toaster-module", mutation.target);
				console.log('Toasters: ' + toasters.length);
				for (let i = 0; i < toasters.length; i++) {
					setAttribute(toasters[i], 'aria-live', 'polite');
				}
				//check for a help dialog
				let help = getElementByClassStart("Page-module_page__", appModule);
				console.log('Game help: ' + help);
				if (help) {
					//setAttribute(gamePage, 'aria-label', 'Help Modal');
					fixCloseButton = true;
				}
			} else if(mutation.type == "attributes") {
				//if the mutation happened to a tile, update its label and its parent
				if(getElementByClassStart("Tile-module_tile__", mutation.target.parentElement)) {
					//only update if the value changed, else we'll enter an infinite loop
					if(mutation.attributeName == "data-state" && mutation.oldValue != mutation.target.getAttribute(mutation.attributeName)) {
						console.log(`Updating a tile. Attribute: ${mutation.attributeName}. Old value: ${mutation.oldValue}. Tile's value: ${mutation.target.getAttribute(mutation.attributeName)}`);
						updateTileLabel(mutation.target);
					} else {
						console.log(`Not updating a tile. Attribute: ${mutation.attributeName}. Old value: ${mutation.oldValue}. Tile's value: ${mutation.target.getAttribute(mutation.attributeName)}`);
						return;
					}
				}
			}
			if(fixCloseButton) {
				let closeButton = getElementByClassStart("Page-module_close__") || getElementByClassStart("Modal-module_close__");
				if (closeButton) {
					console.log('Close: ' + closeButton);
					//give the button a useful name
					closeButton.innerText = "Close";
					//now hide the SVG
					setAttribute(document.getElementsByClassName("game-icon")[0], "aria-hidden", "true");
					closeButton.focus();
				}
			}
		});
	}, 500);
});

let watchGamePage = (gamePage) => {
	gamePageObserver.observe(gamePage,  {
		attributes: true,
		subtree: true
	});
};

let applyFixes = () => {
	try {
		//set up the board as a table, set the tile labels, and other setup
		createGameBoard();
	} catch(error) {
		alert(error);
		return;
	}

	let gamePage = getElementByClassStart("App-module_game__");
	console.log('Game page: ' + gamePage);
	watchGamePage(gamePage);

	let keyboard = getElementByClassStart("Keyboard-module_keyboard__");
	if(keyboard) {
		console.log('Keyboard: ' + keyboard);
		fix(keyboard, false, 'group', 'Keyboard');
		let keys = getElementByClassStart("Key-module_key__", keyboard);
		console.log('Keys: ' + keys.length);
		for (let i = 0; i < keys.length; i++) {
			if (!firstKey) {
				firstKey = keys[i];
			}
			watchKey(keys[i]);
		}
		let backspace = document.querySelector('button[data-key="←"]');
		console.log('Backspace: ' + backspace);
		fix(backspace, false, null, 'backspace');
	}

	let tiles = getElementsByClassStart("Tile-module_tile__");
	console.log('Tiles: ' + tiles.length);
	for (let j = 0; j < tiles.length; j++) {
	}

	let extensionCredit = document.createElement('div');
	extensionCredit.innerHTML = 'Wordle screen reader accessibility extension running.';
	gamePage.insertBefore(extensionCredit, gamePage.firstChild);
};

setTimeout(() => {
	applyFixes();
}, 1000);

};
a11yFix();

