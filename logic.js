const main = document.getElementById('main');
const pdf_input = document.getElementById('input');
const preview_container = document.getElementById('preview_container');
const canvas_container = document.getElementById('canvas_container');
const config_container = document.getElementById('config_container');
const _c_preview_view = document.getElementById('_c_image_view');
const _c_preview_hide = document.getElementById('_c_image_hide');

// Main logic
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';
pdf_input.onchange = async (e) =>
{
	// file
    const file = e.target.files[0];
	if (!file) return;

	// buffer
	const buffer = await file.arrayBuffer();

	// 1st page
	const pdf = await pdfjsLib.getDocument({data: buffer}).promise;
    const page = await pdf.getPage(1);

	// make canvas
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	canvas_container.innerHTML = '';
	canvas_container.appendChild(canvas);

	// get viewport
	const scale = 1;
	const viewport = page.getViewport({scale});
	canvas.width = viewport.width;
    canvas.height = viewport.height;

	// render page
	const renderTask = page.render({canvasContext: ctx, viewport});
    await renderTask.promise;

	// pixels
	const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

	// Enable configging
	config_container.classList.remove('hidden');
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