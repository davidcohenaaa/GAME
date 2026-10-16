const movies = {
    happy: [
        { title: "The Pursuit of Happyness", year: 2006, rating: 8, poster: "https://m.media-amazon.com/images/I/51G3YoE7z6L._AC_.jpg" },
        { title: "Forrest Gump", year: 1994, rating: 8.8, poster: "https://m.media-amazon.com/images/I/61I0a2tzCuL._AC_SY679_.jpg" }
    ],
    sad: [
        { title: "Inside Out", year: 2015, rating: 8.1, poster: "https://m.media-amazon.com/images/I/71T0s81xf-L._AC_SY679_.jpg" },
        { title: "The Fault in Our Stars", year: 2014, rating: 7.7, poster: "https://m.media-amazon.com/images/I/81BJFJcH9-L._AC_SY679_.jpg" }
    ],
    angry: [
        { title: "Rocky", year: 1976, rating: 8.1, poster: "https://m.media-amazon.com/images/I/51JAVwR90QL._AC_.jpg" },
        { title: "Whiplash", year: 2014, rating: 8.5, poster: "https://m.media-amazon.com/images/I/51g06BKOQEL._AC_SY679_.jpg" }
    ],
    bored: [
        { title: "Inception", year: 2010, rating: 8.8, poster: "https://m.media-amazon.com/images/I/51nbVEuw1HL._AC_SY679_.jpg" },
        { title: "The Matrix", year: 1999, rating: 8.7, poster: "https://m.media-amazon.com/images/I/51EG732BV3L._AC_SY679_.jpg" }
    ]
};

function showMovie() {
    const mood = document.getElementById('mood-select').value;
    const movieResultDiv = document.getElementById('movie-result');
    const movieList = movies[mood];

    if (movieList.length > 0) {
        const movie = movieList[Math.floor(Math.random() * movieList.length)];
        movieResultDiv.innerHTML = `<h2>${movie.title} (${movie.year})</h2><p>דירוג: ${movie.rating}</p>`;
    } else {
        movieResultDiv.innerHTML = 'לא נמצאו סרטים למצב הרוח הזה.';
    }
}
