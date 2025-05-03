const main = document.getElementById('main');
const pdf_input = document.getElementById('input');
const highdpi = document.getElementById('highdpi');
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
	saved: [{a: 0, b: 0, c: 0, d: 0,},],
};

// Takes index you're on, saves ready values
function saveCurrentCrop(h)
{
	const arrIndex = cropArray.current - 1;
	const a = Math.round(cropRect.x);
	const b = h - Math.round(cropRect.h) - Math.round(cropRect.y);
	const c = Math.round(cropRect.w);
	const d = Math.round(cropRect.h);
	cropArray.saved[arrIndex] = {a, b, c, d};
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

// ---------------------------------------------------------

// Global
var fileBuffer = null;
var pageHeight = 0;

// first pass
var CONST_DPI = 144;
let changed = false;

// Main logic
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
pdf_input.onchange = async (e) =>
{
	// reset states
	config_container.classList.add('hidden');
	multipage_help.classList.add('hidden');

	// file
    const file = e.target.files[0];
	if (!file) return;

	// buffer
	const arrBuffer = await file.arrayBuffer();
	fileBuffer = arrBuffer.slice(0);

	// 1st page
	const pdf = await pdfjsLib.getDocument({data: arrBuffer}).promise;
	const num_pages = pdf.numPages;
    const page = await pdf.getPage(1);

	// make main canvas
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;
	preview_canvas.innerHTML = '';
	preview_canvas.appendChild(canvas);

	// make virtual canvas
	const vCanvas = document.createElement('canvas');
	const vContext = vCanvas.getContext('2d');
	vContext.imageSmoothingEnabled = false;

	// get viewport
	const pdf_scale = CONST_DPI/72;
	const viewport = page.getViewport({scale: pdf_scale});
	canvas.width = viewport.width >= 600 ? 600 : viewport.width;
	canvas.height = viewport.height >= 600 ? 600: viewport.height;
	vCanvas.width = viewport.width;
	vCanvas.height = viewport.height;

	// height
	pageHeight = viewport.height;

	// render page into vcanvas
	const renderTask = page.render({canvasContext: vContext, viewport});
    await renderTask.promise;

	// make a cropbox
	cropRect.x = 0;
	cropRect.y = 0;
	cropRect.w = vCanvas.width - 1;
	cropRect.h = vCanvas.height - 1;
	cropRect.lastX = 0;
	cropRect.lastY = 0;
	cropRect.offsetX = 0;
	cropRect.offsetY = 0;
	cropRect.vertex = 0;
	cropRect.dragging = false;

	// make crop array
	cropArray = 
	{
		current: 1,
		total: num_pages,
		saved: Array.from({length: num_pages}, () => ({ a: 0, b: 0, c: 0, d: 0 })),
	};

	// Pan and zoom
	let lastX = 0;
	let lastY = 0;
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let isDragging = false;
	let isTouchZooming = false;
	function draw()
	{
		// draw pdf
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.imageSmoothingEnabled = false;
		context.setTransform(scale, 0, 0, scale, offsetX, offsetY);
		context.drawImage(vCanvas, 0, 0);

		// draw crop
		context.setTransform(1, 0, 0, 1, 0, 0);
		const cropX = Math.round(cropRect.x) * scale + offsetX + 0.5 * scale;
		const cropY = Math.round(cropRect.y) * scale + offsetY + 0.5 * scale;
		const cropW = Math.round(cropRect.w) * scale;
		const cropH = Math.round(cropRect.h) * scale;

		context.save();
		context.fillStyle = 'rgba(0, 0, 0, 0.4)';
		context.fillRect(cropX - 0.5*scale, cropY - 0.5*scale, cropW, cropH);
		context.restore();

		context.strokeStyle = 'rgba(255, 0, 0 , 0.6)';
		context.lineWidth = 1 * scale;
		context.strokeRect(cropX, cropY, cropW, cropH);
	}
	// Zoom gesture
	function zoom(e)
	{
		const rect = canvas.getBoundingClientRect();
	
		const zoomFactor = 1.1;
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;
		const scaleFactor = e.deltaY <= 0 ? zoomFactor : 1 / zoomFactor;
	
		const worldX = (mouseX - offsetX) / scale;
		const worldY = (mouseY - offsetY) / scale;
	
		scale *= scaleFactor;
	
		offsetX = mouseX - worldX * scale;
		offsetY = mouseY - worldY * scale;
	
		draw();
	}
	// Press
	function press(x, y)
	{
		const rect = canvas.getBoundingClientRect();
		isDragging = true;
		isTouchZooming = false;
		lastX = x - rect.left;
		lastY = y - rect.top;
	}
	// Move
	function move(x, y)
	{
		if(!isDragging || isTouchZooming) return;
		const rect = canvas.getBoundingClientRect();

		const dx = x - rect.left - lastX;
		const dy = y - rect.top - lastY;

		offsetX += dx;
		offsetY += dy;

		lastX = x - rect.left;
		lastY = y - rect.top;

		draw();
	}
	// End
	function end()
	{
		isDragging = false;
		cropRect.dragging = false;
		canvas.classList.remove('grabbing');
	}
	// PC implementation
	canvas.addEventListener('wheel', (e)=>{e.preventDefault();zoom(e)});
	canvas.addEventListener('mousedown', (e)=>
	{
		canvas.classList.add('grabbing');
		const rect = canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const cropX = cropRect.x * scale + offsetX;
		const cropY = cropRect.y * scale + offsetY;
		const cropW = cropRect.w * scale;
		const cropH = cropRect.h * scale;

		// set which vertex of cropbox youre dragging
		if(
			mouseX >= cropX - scale - 10 &&
			mouseX <= cropX + scale + 10 &&
			mouseY >= cropY - scale - 10 &&
			mouseY <= cropY + scale + 10)
		{
			cropRect.lastX = (mouseX - offsetX) / scale;
			cropRect.lastY = (mouseY - offsetY) / scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 1;
			cropRect.dragging = true;
		}
		else if(
			mouseX >= cropX + cropW - scale - 10 &&
			mouseX <= cropX + cropW + scale + 10 &&
			mouseY >= cropY - scale - 10 &&
			mouseY <= cropY + scale + 10)
		{
			cropRect.lastX = (mouseX - offsetX) / scale;
			cropRect.lastY = (mouseY - offsetY) / scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 2;
			cropRect.dragging = true;
		}
		else if(
			mouseX >= cropX - scale - 10 &&
			mouseX <= cropX + scale + 10 &&
			mouseY >= cropY + cropH - scale - 10 &&
			mouseY <= cropY + cropH + scale + 10)
		{
			cropRect.lastX = (mouseX - offsetX) / scale;
			cropRect.lastY = (mouseY - offsetY) / scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 3;
			cropRect.dragging = true;
		}
		else if(
			mouseX >= cropX + cropW - scale - 10 &&
			mouseX <= cropX + cropW + scale + 10 &&
			mouseY >= cropY + cropH - scale - 10 &&
			mouseY <= cropY + cropH + scale + 10)
		{
			cropRect.lastX = (mouseX - offsetX) / scale;
			cropRect.lastY = (mouseY - offsetY) / scale;
			cropRect.offsetX = 0;
			cropRect.offsetY = 0;
			cropRect.vertex = 4;
			cropRect.dragging = true;
		}
		// normal 
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

		if(cropRect.dragging == true)
		{
			const newX = (mouseX - cropRect.offsetX - offsetX) / scale;
			const newY = (mouseY - cropRect.offsetY - offsetY) / scale;

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

		move(e.clientX, e.clientY);
	});
	canvas.addEventListener('mouseup', ()=>{end()});
	canvas.addEventListener('mouseleave', ()=>{end()});
	// Mobile implementation
	let lastTouchesDist = 0;
	function getTouchesDist(touch1, touch2)
	{
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.hypot(dx, dy);
	}
	function getTouchesX(touch1, touch2)
	{
		return (touch1.clientX + touch2.clientX)/2
	}
	function getTouchesY(touch1, touch2)
	{
		return (touch1.clientY + touch2.clientY)/2
	}
	function mobileStartZoom(touch1, touch2)
	{
		isDragging = false;
		isTouchZooming = true;
		lastTouchesDist = getTouchesDist(touch1, touch2);
	}
	function mobileZoom(touch1, touch2)
	{
		const rect = canvas.getBoundingClientRect();
	
		const zoomFactor = 1.05;
		const touchX = getTouchesX(touch1, touch2) - rect.left;
		const touchY = getTouchesY(touch1, touch2) - rect.top;
		const scaleFactor = getTouchesDist(touch1, touch2) - lastTouchesDist <= 0 ? 1 / zoomFactor : zoomFactor;
	
		const worldX = (touchX - offsetX) / scale;
		const worldY = (touchY - offsetY) / scale;
	
		scale *= scaleFactor;
	
		offsetX = touchX - worldX * scale;
		offsetY = touchY - worldY * scale;

		lastTouchesDist = getTouchesDist(touch1, touch2);
	
		draw();
	}
	function mobileEnd()
	{
		isDragging = false;
		isTouchZooming = false;
	}
	canvas.addEventListener('touchstart', function(e)
	{
		e.preventDefault();
		if(e.touches.length == 1)
		{
			press(e.touches[0].clientX, e.touches[0].clientY);
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
			move(e.touches[0].clientX, e.touches[0].clientY);
		}
		else if(e.touches.length == 2)
		{
			mobileZoom(e.touches[0], e.touches[1]);
		}
	}, {passive: false});
	canvas.addEventListener('touchend', ()=>{mobileEnd()}, {passive: false});
	canvas.addEventListener('touchcancel', ()=>{mobileEnd()}, {passive: false});

	draw();

	// Enable configging
	config_container.classList.remove('hidden');
	if(num_pages > 1)
	{
		multipage_help.classList.remove('hidden');
		multipage_count.innerHTML = cropArray.current + '/' + cropArray.total;
	}

	if(!changed)
	{
		_c_preview_reset.addEventListener('click', ()=>
		{
			// pdf reset
			scale = 1;
			offsetX = 0;
			offsetY = 0;
			lastX = 0;
			lastY = 0;
			isDragging = false;
			isTouchZooming = false;

			// crop reset
			resetCurrentCrop(vCanvas);

			draw();
		})

		changed = true;
	}
}

// View preview
_c_preview_view.addEventListener('click', function()
{
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Hide preview
_c_preview_hide.addEventListener('click', function()
{
	saveCurrentCrop();
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Prev page preview
multipage_prev.addEventListener('click', function()
{
	if(cropArray.current != 1)
	{
		saveCurrentCrop();
		// reset croprect
		// render next page
		cropArray.current -= 1;
		multipage_count.innerHTML = cropArray.current + '/' + cropArray.total;
	}
});

// Next page preview
multipage_next.addEventListener('click', function()
{
	if(cropArray.current != cropArray.total)
	{
		saveCurrentCrop();
		// reset croprect
		// render next page
		cropArray.current += 1;
		multipage_count.innerHTML = cropArray.current + '/' + cropArray.total;
	}
});

// Process
action_button.addEventListener('click', function()
{
	clearOutput(outputElement);
	resizeOutput(outputElement);

	(async() =>{
		const {PDFDocument} = PDFLib;
		const pdfDoc = await PDFDocument.load(fileBuffer);

		const page = pdfDoc.getPage(0);
		const toPt = (px) => px * (72/CONST_DPI);

		const a = Math.round(cropRect.x);
		const b = pageHeight - Math.round(cropRect.h) - Math.round(cropRect.y);
		const c = Math.round(cropRect.w);
		const d = Math.round(cropRect.h);

		page.setCropBox(toPt(a), toPt(b), toPt(c), toPt(d));

		newBytes = await pdfDoc.save();

		// bob
		const bob = new Blob([newBytes], {type: 'application/pdf'});
		const link = document.createElement('a');
		link.href = URL.createObjectURL(bob);
		link.download = 'cropped.pdf';
		link.click();
		URL.revokeObjectURL(link.href);
	})();
});

// High dpi config
highdpi.addEventListener('change', (e) =>
{
	if(e.target.checked)
	{
		CONST_DPI = 288;
	}
	else
	{
		CONST_DPI = 144;
	}

	// must reset everything
});