const main = document.getElementById('main');
const preview_container = document.getElementById('preview_container');
const config_container = document.getElementById('config_container');
const _c_preview_view = document.getElementById('_c_image_view');
const _c_preview_hide = document.getElementById('_c_image_hide');

// Main logic
function done()
{
	// ...

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