let page = 0;
let isFetching = false;
let exhaustedAPIs = new Set();
let variationIndex = 0;

// API WRAPPERS
async function safeFetch(apiName, fetcher) {
    if (exhaustedAPIs.has(apiName)) return [];
    try {
        const res = await fetcher();
        if (!res || res.length === 0) exhaustedAPIs.add(apiName);
        return res || [];
    } catch (e) {
        const msg = e.message || "";
        if (msg.includes("401") || msg.includes("403") || msg.includes("429")) {
            console.warn(`Disabling ${apiName} due to error: ${msg}`);
            exhaustedAPIs.add(apiName);
        }
        return [];
    }
}

async function fetchGoogle(activeQuery) {
    if (page > 8) return [];
    try {
        const start = 1; // Always get top results for the *new variation*
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${API_KEYS.googleKey}&cx=${API_KEYS.googleCx}&q=${encodeURIComponent(activeQuery)}&searchType=image&num=10&start=${start}&imgSize=large`);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        return (data.items || []).map(item => ({ src: item.link, alt: item.title, source: 'Google' }));
    } catch (e) { throw e; }
}

async function fetchTmdb(activeQuery) {
    // CLEAN QUERY: Remove "wallpaper", "aesthetic" etc to get clean Actor Name
    // This fixes "Kiara Advani wallpaper" failing to find person "Kiara Advani"
    let cleanQuery = activeQuery;
    VARIATIONS.forEach(v => {
        if (v.trim().length > 0) cleanQuery = cleanQuery.replace(v, "");
    });
    cleanQuery = cleanQuery.trim();

    try {
        // Person Search (ACTOR / ACTRESS)
        const personRes = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${API_KEYS.tmdb}&query=${encodeURIComponent(cleanQuery)}`);
        if (personRes.ok) {
            const personData = await personRes.json();
            const people = (personData.results || []).filter(p => p.profile_path).map(p => ({
                src: `https://image.tmdb.org/t/p/h632${p.profile_path}`,
                alt: p.name,
                source: 'TMDB_Actor'
            }));
            if (people.length > 0) return people;
        }
    } catch (e) { }

    // Fallback: Movie Search (use original query for context)
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEYS.tmdb}&query=${encodeURIComponent(activeQuery)}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.results || []).filter(m => m.poster_path).map(m => ({ src: `https://image.tmdb.org/t/p/w500${m.poster_path}`, alt: m.title, source: 'TMDB_Movie' }));
}

async function fetchUnsplash(activeQuery) {
    const res = await fetch(`https://api.unsplash.com/search/photos?page=${page + 1}&per_page=15&query=${encodeURIComponent(activeQuery)}&client_id=${API_KEYS.unsplash}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.results || []).map(img => ({ src: img.urls.regular, alt: img.alt_description, source: 'Unsplash' }));
}

async function fetchPixabay(activeQuery) {
    const res = await fetch(`https://pixabay.com/api/?key=${API_KEYS.pixabay}&q=${encodeURIComponent(activeQuery)}&image_type=photo&per_page=20&page=${page + 1}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.hits || []).map(img => ({ src: img.webformatURL, alt: img.tags, source: 'Pixabay' }));
}

async function fetchPexels(activeQuery) {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(activeQuery)}&per_page=20&page=${page + 1}`, { headers: { Authorization: API_KEYS.pexels } });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.photos || []).map(img => ({ src: img.src.large, alt: img.alt, source: 'Pexels' }));
}

async function fetchNasa(activeQuery) {
    const res = await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(activeQuery)}&media_type=image`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return (data.collection.items || []).slice(0, 10).map(i => ({ src: i.links[0].href, alt: i.data[0].title, source: 'NASA' }));
}

async function fetchWikimedia(activeQuery) {
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(activeQuery)}&gsrlimit=10&prop=imageinfo&iiprop=url&format=json&origin=*&gsroffset=${page * 10}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (!data.query || !data.query.pages) return [];
    return Object.values(data.query.pages).map(p => ({ src: p.imageinfo[0].url, alt: p.title.replace("File:", ""), source: 'Wiki' }));
}

// MASTER LOAD
async function fetchAllSources(activeQuery) {
    // We intentionally ignore pageNum here for related items simplifiction
    // The global 'page' var is managed in loadImages

    // FETCH PARALLEL
    const results = await Promise.all([
        safeFetch('tmdb', () => fetchTmdb(activeQuery)),      // Priority 1
        safeFetch('google', () => fetchGoogle(activeQuery)),  // Priority 2
        safeFetch('unsplash', () => fetchUnsplash(activeQuery)), // Priority 3
        safeFetch('pexels', () => fetchPexels(activeQuery)),
        safeFetch('pixabay', () => fetchPixabay(activeQuery)),
        safeFetch('nasa', () => fetchNasa(activeQuery)),
        safeFetch('wiki', () => fetchWikimedia(activeQuery))
    ]);

    // FLATTEN
    return results.flat();
}

async function loadImages() {
    if (isFetching) return;
    isFetching = true;
    document.getElementById('homeLoader').style.display = 'block';

    const rawQuery = document.getElementById('searchInput').value || 'sun';

    // SMART EXPANSION LOGIC
    // Cycle through variations: "" (clean), " aesthetic", " wallpaper" ...
    const variation = VARIATIONS[page % VARIATIONS.length];
    const activeQuery = rawQuery + variation;

    console.log(`Smart Search: "${activeQuery}" (Page ${page})`);

    let allImages = await fetchAllSources(activeQuery);

    if (allImages.length === 0 && page === 0) {
        gallery.innerHTML = '<div style="text-align:center; width:100%; padding:20px;">No exact results found. We will widen the search...</div>';
        // Auto-retry with variation if 0 results
        if (page === 0) { page++; isFetching = false; loadImages(); return; }
    } else {
        // STRICT PRIORITIZATION
        // 1. TMDB Person Results (Highest Quality for Actors)
        // 2. Google Results (High Relevance)
        // 3. Others (Fillers)
        const highQuality = allImages.filter(img => img.source === 'TMDB' || img.source === 'Google');
        const others = allImages.filter(img => img.source !== 'TMDB' && img.source !== 'Google');

        // We Interleave filler to ensure layout isn't empty, but strictly put HQ first
        // Actually for infinite scroll, let's just dump HQ then others. 
        // Best experience: user sees the person first.
        allImages = [...highQuality, ...others];

        allImages.forEach(img => {
            const pin = createPinHTML(img.src, img.alt || "Pinterest Image");
            // Add source tag
            if (img.source) {
                const tag = document.createElement('span');
                tag.className = `source-tag source-${img.source.toLowerCase()}`;
                tag.innerText = img.source;
                // Add to overlay
                const overlay = pin.querySelector('.pin-overlay');
                if (overlay) overlay.insertBefore(tag, overlay.firstChild);
            }
            gallery.appendChild(pin);
        });
    }
    page++;
    document.getElementById('homeLoader').style.display = 'none';
    isFetching = false;
}

async function fetchRelatedImages(query) {
    // Just fetch one batch
    return await fetchAllSources(query + " aesthetic");
}

// DATA - User Pins
async function savePinToSheet(imgUrl, title) {
    if (!currentUser) return;
    fetch(SCRIPT_URL, {
        method: 'POST', body: JSON.stringify({ action: 'savePin', email: currentUser.email, imageUrl: imgUrl, title: title })
    }).catch(e => console.log("Save bg call sent"));
}

async function fetchUserPins() {
    if (!currentUser) return [];
    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST', body: JSON.stringify({ action: 'getPins', email: currentUser.email })
        });
        const data = await res.json();
        return data.pins || [];
    } catch (e) { return []; }
}
