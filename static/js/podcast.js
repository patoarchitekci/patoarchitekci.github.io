const container = document.getElementById("podcast-container");
let currentPlayingVideo = null;
// < !-- ===== PODCAST UI ===== -->
podcastData.forEach((data, index) => {
    const card = document.createElement("div");
    card.className =
        "flex flex-col md:flex-row sm:gap-[30px] gap-5 md:py-10 lg:py-[50px] py-7 md:items-center justify-center";
    card.innerHTML = `
        <div class="relative video-wrapper max-w-max" data-index="${index}">
            <img width="400" height="300" src="${data.thumbnail}" alt="thumbnail"
                class="md:rounded-[30px] rounded-2xl lg:max-w-[400px] md:max-w-[300px] max-w-[330px] xl:h-[300px] lg:h-[330px] md:h-[265px] h-[195px]" />
            <img width="69" height="69" src="/img/svg/play-btn.svg" alt="play"
                class="rounded-full cursor-pointer sm:max-w-[69px] sm:h-[69px] max-sm:size-11 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 play-button" />
        </div>
        <div class="mb-0 max-lg:max-w-[550px]">
            <h2 class="font-tomorrow font-semibold lg:text-4xl custom-md:text-custom-3xl sm:text-2xl text-xl !leading-119 text-orange lg:mb-5 mb-2.5 uppercase">${data.title}</h2>
            <p class="font-normal lg:text-base sm:text-sm text-xs text-white sm:!leading-119 !leading-125 xl:mb-9 lg:mb-7 mb-4 max-w-[805px]">${data.description}</p>
            <div class="flex flex-wrap items-center gap-1 lg:mb-10 mb-5 ">
                ${data.tags.map(tag => `<span class="font-normal sm:text-sm text-custom-xs sm:!leading-100 leading-120 text-orange">${tag}</span>`).join("")}
            </div>
            <a href="/podcast.html">
            <button class="bg-white font-semibold lg:text-xl sm:text-lg text-custom-base leading-100 text-dark-black flex items-center sm:gap-3 gap-2.5 sm:py-[5px] py-[3.75px] sm:ps-[5px] ps-[3.75px] sm:pe-[28px] pe-[18px] rounded-full lg:min-w-[243px] transition-all ease-linear duration-300 group">
                <div class="bg-orange sm:size-[36px] size-7 flex justify-center items-center rounded-full group-hover:max-w-[48px] group-hover:w-[48px] transition-all ease-linear duration-300">
                    <img width="23" height="22" src="/img/svg/arrow-icon.svg" class="rounded-full lg:w-[22px] lg:h-5 size-4" />
                </div>
                Obejrzyj Podcast
            </button>
            </a>
        </div>
        `;
    container.appendChild(card);
});

// < !-- ===== PODCAST ON CLICK ===== -->
document.addEventListener("click", function (e) {
    if (e.target.closest('.play-button')) {
        const wrapper = e.target.closest('.video-wrapper');
        const index = wrapper.getAttribute("data-index");
        const videoUrl = podcastData[index].videoUrl;

        if (currentPlayingVideo && currentPlayingVideo !== wrapper) {
            const currentIndex = currentPlayingVideo.getAttribute("data-index");
            const currentData = podcastData[currentIndex];
            currentPlayingVideo.innerHTML = `
        <img width="400" height="300" src="${currentData.thumbnail}" alt="thumbnail"
            class="md:rounded-[30px] rounded-2xl lg:max-w-[400px] md:max-w-[300px] max-w-[330px] xl:h-[300px] lg:h-[330px] md:h-[265px] h-[195px]" />
        <img width="69" height="69" src="/img/svg/play-btn.svg" alt="play"
            class="rounded-full cursor-pointer sm:max-w-[69px] sm:h-[69px] max-sm:size-11 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 play-button" />
        `;
            currentPlayingVideo.classList.remove("iframe-loading", "iframe-loaded");
        }

        wrapper.classList.add("iframe-loading");
        wrapper.classList.remove("iframe-loaded");
        wrapper.innerHTML = "";

        const iframe = document.createElement("iframe");
        iframe.src = videoUrl + "?autoplay=1&rel=0";
        iframe.allow = "autoplay; encrypted-media";
        iframe.allowFullscreen = true;
        iframe.className =
            "md:rounded-[30px] rounded-2xl lg:w-[400px] md:w-[300px] w-[330px] xl:h-[300px] lg:h-[330px] md:h-[265px] h-[195px]";

        iframe.onload = () => {
            wrapper.classList.remove("iframe-loading");
            wrapper.classList.add("iframe-loaded");
        };

        wrapper.appendChild(iframe);
        currentPlayingVideo = wrapper;
    }
});
