const main = document.getElementById('main');
const pdf_input = document.getElementById('input');
const preview_container = document.getElementById('preview_container');
const canvas_container = document.getElementById('canvas_container');
const config_container = document.getElementById('config_container');
const _c_preview_view = document.getElementById('_c_preview_view');
const _c_preview_hide = document.getElementById('_c_preview_hide');
const _c_preview_reset = document.getElementById('_c_preview_reset');
const action_button = document.getElementById('action_button');

// initialize
var cropRect =
{
	x: 0,
	y: 0,
	lastX: 0,
	lastY: 0,
	w: 0,
	h: 0,
	vertex: 0,
	dragging: false,
	dragOffsetX: 0,
	dragOffsetY: 0,
};

// first pass
let changed = false;

// Main logic
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
pdf_input.onchange = async (e) =>
{
	// reset state
	config_container.classList.add('hidden');

	// file
    const file = e.target.files[0];
	if (!file) return;

	// buffer
	const buffer = await file.arrayBuffer();

	// 1st page
	const pdf = await pdfjsLib.getDocument({data: buffer}).promise;
    const page = await pdf.getPage(1);

	// make main canvas
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;
	canvas_container.innerHTML = '';
	canvas_container.appendChild(canvas);

	// make virtual canvas
	const vCanvas = document.createElement('canvas');
	const vContext = vCanvas.getContext('2d');
	vContext.imageSmoothingEnabled = false;

	// get viewport
	const pdf_scale = 1;
	const viewport = page.getViewport({scale: pdf_scale});
	canvas.width = viewport.width >= 600 ? 600 : viewport.width;
	canvas.height = viewport.height >= 600 ? 600: viewport.height;
	vCanvas.width = viewport.width;
	vCanvas.height = viewport.height;

	// render page into vcanvas
	const renderTask = page.render({canvasContext: vContext, viewport});
    await renderTask.promise;

	// make a cropbox
	cropRect.x = 0;
	cropRect.y = 0;
	cropRect.lastX = 0;
	cropRect.lastY = 0;
	cropRect.w = vCanvas.width - 1;
	cropRect.h = vCanvas.height - 1;
	cropRect.vertex = 0;
	cropRect.dragging = false;
	cropRect.dragOffsetX = 0;
	cropRect.dragOffsetY = 0;

	// Pan and zoom
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let lastX = 0;
	let lastY = 0;
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
			cropRect.dragOffsetX = 0;
			cropRect.dragOffsetY = 0;
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
			cropRect.dragOffsetX = 0;
			cropRect.dragOffsetY = 0;
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
			cropRect.dragOffsetX = 0;
			cropRect.dragOffsetY = 0;
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
			cropRect.dragOffsetX = 0;
			cropRect.dragOffsetY = 0;
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
			const newX = (mouseX - cropRect.dragOffsetX - offsetX) / scale;
			const newY = (mouseY - cropRect.dragOffsetY - offsetY) / scale;

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
			cropRect =
			{
				x: 0,
				y: 0,
				lastX: 0,
				lastY: 0,
				w: vCanvas.width - 1,
				h: vCanvas.height - 1,
				vertex: 0,
				dragging: false,
				dragOffsetX: 0,
				dragOffsetY: 0,
			};

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
	preview_container.classList.toggle('hidden');
	main.classList.toggle('blurred');
});

// Send request
action_button.addEventListener('click', function()
{
	clearOutput(outputElement);
	resizeOutput(outputElement);
	
	console.log(Math.round(cropRect.x));
	console.log(Math.round(cropRect.y));
	console.log(Math.round(cropRect.w));
	console.log(Math.round(cropRect.h));
});