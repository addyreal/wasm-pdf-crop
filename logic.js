// DOM
const main = document.getElementById('main');
const outputElement = document.getElementById('output');
const pdf_input = document.getElementById('input');
const _c_highdpi = document.getElementById('_c_highdpi');
const preview_container = document.getElementById('preview_container');
const preview_canvas = document.getElementById('preview_canvas');
const _c_preview_view = document.getElementById('_c_preview_view');
const _c_preview_hide = document.getElementById('_c_preview_hide');
const _c_preview_reset = document.getElementById('_c_preview_reset');
const config_container = document.getElementById('config_container');
const multipage_help = document.getElementById('multipage_help');
const multipage_prev = document.getElementById('multipage_prev');
const multipage_next = document.getElementById('multipage_next');
const multipage_count = document.getElementById('multipage_count');
const action_button = document.getElementById('action_button');

// Global
var filename = "";
var fileBuffer = null;
var PDFDoc = null;
var num_pages = 0;
var renderInProgress = false;

async function renderPDFPage(i)
{
	// Get page
	const page = await PDFDoc.getPage(i);

	// Set up canvases
	const viewport = page.getViewport({scale: CONST_DPI/72});
	canvas.width = viewport.width >= 600 ? 600 : viewport.width;
	canvas.height = viewport.height >= 600 ? 600: viewport.height;
	vCanvas.width = viewport.width;
	vCanvas.height = viewport.height;

	// Render page
	const renderTask = page.render({canvasContext: vContext, viewport});
	await renderTask.promise;
}

// -------------------- OUTPUT -----------------------------

function getLineCount(textarea)
{
    return textarea.value.split('\n').length - 1;
}
function resizeOutput(textarea)
{
	textarea.style.height = "calc(1.2rem * " + getLineCount(textarea) + " + 70px)";
}
function clearOutput(textarea)
{
	textarea.value = "";
}
clearOutput(outputElement);

// ---------------------------------------------------------

// -------------------- CANVAS -----------------------------

// Main canvas
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

// Virtual canvas
const vCanvas = document.createElement('canvas');
const vContext = vCanvas.getContext('2d');
vContext.imageSmoothingEnabled = false;

// Constants
var CONST_DPI = 144;
const CONST_CROPTHICKNESS = 1;
const CONST_ZOOMFACTOR = 1.1;
const CONST_MOBILEZOOMFACTOR = 1.05;

// Draw, vCanvas into canvas
function draw()
{
	// draw pdf
	context.setTransform(1, 0, 0, 1, 0, 0);
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.imageSmoothingEnabled = false;
	context.setTransform(previewWindow.scale, 0, 0, previewWindow.scale, previewWindow.offsetX, previewWindow.offsetY);
	context.drawImage(vCanvas, 0, 0);

	// draw crop
	context.setTransform(1, 0, 0, 1, 0, 0);
	const cropX = Math.round(cropRect.x) * previewWindow.scale + previewWindow.offsetX + CONST_CROPTHICKNESS/2 * previewWindow.scale;
	const cropY = Math.round(cropRect.y) * previewWindow.scale + previewWindow.offsetY + CONST_CROPTHICKNESS/2 * previewWindow.scale;
	const cropW = Math.round(cropRect.w) * previewWindow.scale;
	const cropH = Math.round(cropRect.h) * previewWindow.scale;

	context.save();
	context.fillStyle = 'rgba(0, 0, 0, 0.4)';
	context.fillRect(cropX - CONST_CROPTHICKNESS/2 * previewWindow.scale, cropY - CONST_CROPTHICKNESS/2 * previewWindow.scale, cropW, cropH);
	context.restore();

	context.strokeStyle = 'rgba(255, 0, 0 , 0.6)';
	context.lineWidth = CONST_CROPTHICKNESS * previewWindow.scale;
	context.strokeRect(cropX, cropY, cropW, cropH);
}

// Click
function press(x, y)
{
	const rect = canvas.getBoundingClientRect();
	previewWindow.isDragging = true;
	previewWindow.isTouchZooming = false;
	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;
}

// Move
function move(x, y)
{
	if(!previewWindow.isDragging || previewWindow.isTouchZooming) return;
	const rect = canvas.getBoundingClientRect();

	const dx = x - rect.left - previewWindow.lastX;
	const dy = y - rect.top - previewWindow.lastY;

	previewWindow.offsetX += dx;
	previewWindow.offsetY += dy;

	previewWindow.lastX = x - rect.left;
	previewWindow.lastY = y - rect.top;

	draw();
}

// Zoom
function zoom(e)
{
	const rect = canvas.getBoundingClientRect();

	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;
	const scaleFactor = e.deltaY <= 0 ? CONST_ZOOMFACTOR : 1 / CONST_ZOOMFACTOR;

	const worldX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (mouseY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = mouseX - worldX * previewWindow.scale;
	previewWindow.offsetY = mouseY - worldY * previewWindow.scale;

	draw();
}

// End
function end()
{
	previewWindow.isDragging = false;
	cropRect.dragging = false;
	canvas.classList.remove('grabbing');
}

// Mobile
function getTouchesDist(touch1, touch2)
{
	const dx = touch1.clientX - touch2.clientX;
	const dy = touch1.clientY - touch2.clientY;
	return Math.hypot(dx, dy);
}
function getTouchesX(touch1, touch2)
{
	return (touch1.clientX + touch2.clientX)/2;
}
function getTouchesY(touch1, touch2)
{
	return (touch1.clientY + touch2.clientY)/2;
}
function mobileStartZoom(touch1, touch2)
{
	cropRect.dragging = false;
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = true;
	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);
}
function mobileZoom(touch1, touch2)
{
	const rect = canvas.getBoundingClientRect();

	const touchX = getTouchesX(touch1, touch2) - rect.left;
	const touchY = getTouchesY(touch1, touch2) - rect.top;
	const scaleFactor = getTouchesDist(touch1, touch2) - previewWindow.lastTouchesDist <= 0 ? 1 / CONST_MOBILEZOOMFACTOR : CONST_MOBILEZOOMFACTOR;

	const worldX = (touchX - previewWindow.offsetX) / previewWindow.scale;
	const worldY = (touchY - previewWindow.offsetY) / previewWindow.scale;

	previewWindow.scale *= scaleFactor;

	previewWindow.offsetX = touchX - worldX * previewWindow.scale;
	previewWindow.offsetY = touchY - worldY * previewWindow.scale;

	previewWindow.lastTouchesDist = getTouchesDist(touch1, touch2);

	draw();
}
function mobileEnd()
{
	cropRect.dragging = false;
	previewWindow.isDragging = false;
	previewWindow.isTouchZooming = false;
}

// ---------------------------------------------------------

// -------------------- PREVIEW ----------------------------

// Preview window stuff
var previewWindow =
{
	scale: 1,
	lastTouchesDist: 0,
	lastX: 0,
	lastY: 0,
	offsetX: 0,
	offsetY: 0,
	isDragging: false,
	isTouchZooming: false,
};

// Resets current crop
function resetPreviewWindow()
{
	previewWindow =
	{
		scale: 1,
		lastTouchesDist: 0,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		isDragging: false,
		isTouchZooming: false,
	};
}

// ---------------------------------------------------------

// -------------------- CROPPING ---------------------------

// Rendered crop helper
var cropRect =
{
	x: 0,
	y: 0,
	w: 0,
	h: 0,
	lastX: 0,
	lastY: 0,
	offsetX: 0,
	offsetY: 0,
	vertex: 0,
	dragging: false,
};

// Stored crop preferences
var cropArray = 
{
	current: 1,
	total: 1,
	saved: [{x: 0, y: 0, w: 0, h: 0,},],
	sizes: [{pw: 0, ph: 0}],
};

// Takes index you're on, saves ready values
function saveCurrentCrop(box)
{
	const arrIndex = cropArray.current - 1;
	const x = cropRect.x;
	const y = cropRect.y;
	const w = cropRect.w;
	const h = cropRect.h;
	cropArray.saved[arrIndex] = {x, y, w, h};
	const pw = box.width - 1;
	const ph = box.height - 1;
	cropArray.sizes[arrIndex] = {pw, ph};
}

// Resets current crop
function resetCurrentCrop(box)
{
	cropRect =
	{
		x: 0,
		y: 0,
		w: box.width - 1,
		h: box.height - 1,
		lastX: 0,
		lastY: 0,
		offsetX: 0,
		offsetY: 0,
		vertex: 0,
		dragging: false,
	};
}

// Restrores current crop
function restoreCurrentCrop(index, box)
{
	// Exists saved crop
	if(cropArray.saved[index - 1].w != 0)
	{
		cropRect =
		{
			x: cropArray.saved[index - 1].x,
			y: cropArray.saved[index - 1].y,
			w: cropArray.saved[index - 1].w,
			h: cropArray.saved[index - 1].h,
			lastX: 0,
			lastY: 0,
			offsetX: 0,
			offsetY: 0,
			vertex: 0,
			dragging: false,
		};
	}
	// Else just give default
	else
	{
		resetCurrentCrop(box);
	}
}

function resetCropArray(len)
{
	cropArray = 
	{
		current: 1,
		total: len,
		saved: Array.from({length: len}, () => ({x: 0, y: 0, w: 0, h: 0})),
		sizes: Array.from({length: len}, () => ({pw: 0, ph: 0})),
	};
}

// ---------------------------------------------------------

// Main logic
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
pdf_input.onchange = async (e) =>
{
	// Disable UI (reset)
	config_container.classList.add('hidden');
	multipage_help.classList.add('hidden');

	// Get file
    const file = e.target.files[0];
	if (!file) return;

	// Store filename
	filename = file.name.replace(/\.pdf$/i, '');

	// Get and copy file buffer
	const arrBuffer = await file.arrayBuffer();
	fileBuffer = arrBuffer.slice(0);

	// Load pdf
	PDFDoc = await pdfjsLib.getDocument({data: arrBuffer}).promise;

	// Render 1st page
	renderInProgress = true;
	await renderPDFPage(1);
	renderInProgress = false;

	// Reset cropbox
	resetCurrentCrop(vCanvas);

	// Reset preview window
	resetPreviewWindow();

	// Initialize crop array
	num_pages = PDFDoc.numPages;
	resetCropArray(num_pages);

	// Draw
	draw();

	// Enable UI
	config_container.classList.remove('hidden');
	if(num_pages > 1)
	{
		multipage_help.classList.remove('hidden');
		multipage_count.innerHTML = cropArray.current + '/' + cropArray.total;
	}
}

// -------------------- EVENT LISTENERS --------------------

// -------------------- CANVAS LISTENERS -------------------

// -------------------- PC IMPLEMENTATION ------------------
canvas.addEventListener('wheel', (e)=>
{
	e.preventDefault();
	zoom(e);
});
canvas.addEventListener('mousedown', (e)=>
{
	canvas.classList.add('grabbing');
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Vertex grabbing
	const cropX = cropRect.x * previewWindow.scale + previewWindow.offsetX;
	const cropY = cropRect.y * previewWindow.scale + previewWindow.offsetY;
	const cropW = cropRect.w * previewWindow.scale;
	const cropH = cropRect.h * previewWindow.scale;
	if(
		mouseX >= cropX - previewWindow.scale - 10 &&
		mouseX <= cropX + previewWindow.scale + 10 &&
		mouseY >= cropY - previewWindow.scale - 10 &&
		mouseY <= cropY + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 1;
		cropRect.dragging = true;
	}
	else if(
		mouseX >= cropX + cropW - previewWindow.scale - 10 &&
		mouseX <= cropX + cropW + previewWindow.scale + 10 &&
		mouseY >= cropY - previewWindow.scale - 10 &&
		mouseY <= cropY + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 2;
		cropRect.dragging = true;
	}
	else if(
		mouseX >= cropX - previewWindow.scale - 10 &&
		mouseX <= cropX + previewWindow.scale + 10 &&
		mouseY >= cropY + cropH - previewWindow.scale - 10 &&
		mouseY <= cropY + cropH + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 3;
		cropRect.dragging = true;
	}
	else if(
		mouseX >= cropX + cropW - previewWindow.scale - 10 &&
		mouseX <= cropX + cropW + previewWindow.scale + 10 &&
		mouseY >= cropY + cropH - previewWindow.scale - 10 &&
		mouseY <= cropY + cropH + previewWindow.scale + 10)
	{
		cropRect.lastX = (mouseX - previewWindow.offsetX) / previewWindow.scale;
		cropRect.lastY = (mouseY - previewWindow.offsetY) / previewWindow.scale;
		cropRect.offsetX = 0;
		cropRect.offsetY = 0;
		cropRect.vertex = 4;
		cropRect.dragging = true;
	}
	// Other grabbing (panning)
	else
	{
		press(e.clientX, e.clientY);
	}
});
canvas.addEventListener('mousemove', (e)=>
{
	e.preventDefault();
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Vertex grabbing
	if(cropRect.dragging == true)
	{
		const newX = (mouseX - cropRect.offsetX - previewWindow.offsetX) / previewWindow.scale;
		const newY = (mouseY - cropRect.offsetY - previewWindow.offsetY) / previewWindow.scale;
		let dx = newX - cropRect.lastX;
		let dy = newY - cropRect.lastY;

		switch(cropRect.vertex)
		{
			case 1:
				cropRect.x += dx;
				cropRect.y += dy;
				cropRect.w -= dx;
				cropRect.h -= dy;
				break;
			case 2:
				cropRect.y += dy;
				cropRect.w += dx;
				cropRect.h -= dy;
				break;
			case 3:
				cropRect.x += dx;
				cropRect.w -= dx;
				cropRect.h += dy;
				break;
			case 4:
				cropRect.w += dx;
				cropRect.h += dy;
				break;
		}

		cropRect.lastX = newX;
		cropRect.lastY = newY;

		draw();
	}
	// Maybe other grabbing (panning)
	else
	{
		move(e.clientX, e.clientY);
	}
});
canvas.addEventListener('mouseup', ()=>
{
	end();
});
canvas.addEventListener('mouseleave', ()=>
{
	end();
});

// -------------------- MOBILE IMPLEMENTATION --------------
canvas.addEventListener('touchstart', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		const rect = canvas.getBoundingClientRect();
		const touchX = e.touches[0].clientX - rect.left;
		const touchY = e.touches[0].clientY - rect.top;

		// Vertex grabbing
		const cropX = cropRect.x * previewWindow.scale + previewWindow.offsetX;
		const cropY = cropRect.y * previewWindow.scale + previewWindow.offsetY;
		const cropW = cropRect.w * previewWindow.scale;
		const cropH = cropRect.h * previewWindow.scale;
		if(
			touchX >= cropX - previewWindow.scale - 20 &&
			touchX <= cropX + previewWindow.scale + 20 &&
			touchY >= cropY - previewWindow.scale - 20 &&
			touchY <= cropY + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 1;
			cropRect.dragging = true;
		}
		else if(
			touchX >= cropX + cropW - previewWindow.scale - 20 &&
			touchX <= cropX + cropW + previewWindow.scale + 20 &&
			touchY >= cropY - previewWindow.scale - 20 &&
			touchY <= cropY + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 2;
			cropRect.dragging = true;
		}
		else if(
			touchX >= cropX - previewWindow.scale - 20 &&
			touchX <= cropX + previewWindow.scale + 20 &&
			touchY >= cropY + cropH - previewWindow.scale - 20 &&
			touchY <= cropY + cropH + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 3;
			cropRect.dragging = true;
		}
		else if(
			touchX >= cropX + cropW - previewWindow.scale - 20 &&
			touchX <= cropX + cropW + previewWindow.scale + 20 &&
			touchY >= cropY + cropH - previewWindow.scale - 20 &&
			touchY <= cropY + cropH + previewWindow.scale + 20)
		{
			cropRect.lastX = (touchX - previewWindow.offsetX) / previewWindow.scale;
			cropRect.lastY = (touchY - previewWindow.offsetY) / previewWindow.scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 4;
			cropRect.dragging = true;
		}
		// Other grabbing (panning)
		else
		{
			press(e.touches[0].clientX, e.touches[0].clientY);
		}
	}
	else if(e.touches.length == 2)
	{
		mobileStartZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchmove', function(e)
{
	e.preventDefault();
	if(e.touches.length == 1)
	{
		// Vertex grabbing
		if(cropRect.dragging == true)
		{
			const rect = canvas.getBoundingClientRect();
			const touchX = e.touches[0].clientX - rect.left;
			const touchY = e.touches[0].clientY - rect.top;
			const newX = (touchX - cropRect.offsetX - previewWindow.offsetX) / previewWindow.scale;
			const newY = (touchY - cropRect.offsetY - previewWindow.offsetY) / previewWindow.scale;
			let dx = newX - cropRect.lastX;
			let dy = newY - cropRect.lastY;
	
			switch(cropRect.vertex)
			{
				case 1:
					cropRect.x += dx;
					cropRect.y += dy;
					cropRect.w -= dx;
					cropRect.h -= dy;
					break;
				case 2:
					cropRect.y += dy;
					cropRect.w += dx;
					cropRect.h -= dy;
					break;
				case 3:
					cropRect.x += dx;
					cropRect.w -= dx;
					cropRect.h += dy;
					break;
				case 4:
					cropRect.w += dx;
					cropRect.h += dy;
					break;
			}
	
			cropRect.lastX = newX;
			cropRect.lastY = newY;
	
			draw();
		}
		// Maybe other grabbing (panning)
		else
		{
			move(e.touches[0].clientX, e.touches[0].clientY);
		}
	}
	else if(e.touches.length == 2)
	{
		mobileZoom(e.touches[0], e.touches[1]);
	}
}, {passive: false});
canvas.addEventListener('touchend', ()=>
{
	mobileEnd();
}, {passive: false});
canvas.addEventListener('touchcancel', ()=>
{
	mobileEnd();
}, {passive: false});

// ---------------------------------------------------------

// -------------------- OTHER LISTENERS --------------------

// High dpi config
_c_highdpi.addEventListener('change', (e) =>
{
	if(e.target.checked)
	{
		CONST_DPI = 288;
	}
	else
	{
		CONST_DPI = 144;
	}

	// must reset everything, temp implementation - disable UI so user has to reupload
	config_container.classList.add('hidden');
	multipage_help.classList.add('hidden');
});

// View preview
_c_preview_view.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Reset preview
_c_preview_reset.addEventListener('click', ()=>
{
	// preview reset
	resetPreviewWindow();

	// crop reset
	resetCurrentCrop(vCanvas);

	draw();
})

// Hide preview
_c_preview_hide.addEventListener('click', function()
{
	saveCurrentCrop(vCanvas);
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Multipage previous page
multipage_prev.addEventListener('click', async function()
{
	if(cropArray.current != 1 && !renderInProgress)
	{
		renderInProgress = true;
		saveCurrentCrop(vCanvas);
		cropArray.current -= 1;
		await renderPDFPage(cropArray.current);
		restoreCurrentCrop(cropArray.current, vCanvas);
		draw();
		multipage_count.innerHTML = cropArray.current + '/' + cropArray.total;
		renderInProgress = false;
	}
});

// Multipage next page
multipage_next.addEventListener('click', async function()
{
	if(cropArray.current != cropArray.total && !renderInProgress)
	{
		renderInProgress = true;
		saveCurrentCrop(vCanvas);
		cropArray.current += 1;
		await renderPDFPage(cropArray.current);
		restoreCurrentCrop(cropArray.current, vCanvas);
		draw();
		multipage_count.innerHTML = cropArray.current + '/' + cropArray.total;
		renderInProgress = false;
	}
});

// Process
action_button.addEventListener('click', function()
{
	clearOutput(outputElement);
	resizeOutput(outputElement);

	(async() =>{
		// Load PDF
		const {PDFDocument} = PDFLib;
		const pdfDoc = await PDFDocument.load(fileBuffer);

		// Conversion
		const toPt = (px) => px * (72/CONST_DPI);
		const toPx = (pt) => pt * (CONST_DPI/72);

		// Loop through all pages and apply a cropbox
		for(let i = 1; i <= num_pages; i++)
		{
			const page = pdfDoc.getPage(i - 1);
			const width = cropArray.sizes[i - 1].pw;
			const height = cropArray.sizes[i - 1].ph;
			
			const savedCrop = cropArray.saved[i - 1];

			const a = Math.round(savedCrop.x);
			const b = height - Math.round(savedCrop.h) - Math.round(savedCrop.y);
			const c = Math.round(savedCrop.w);
			const d = Math.round(savedCrop.h);

			// Apply a crop that you atleast saved (or amounts to anything)
			if(c != 0 && d != 0)
			{
				// Apply a meaningful crop
				if(c != width && d != height)
				{
					page.setCropBox(toPt(a), toPt(b), toPt(c), toPt(d));
				}
			}
		}

		// Save the PDF
		newBytes = await pdfDoc.save();

		// Make bob
		const bob = new Blob([newBytes], {type: 'application/pdf'});
		const link = document.createElement('a');
		link.href = URL.createObjectURL(bob);
		link.download = filename + '-cropped' + '.pdf';
		link.click();
		URL.revokeObjectURL(link.href);
	})();
});