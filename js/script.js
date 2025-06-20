import { tmdbConfig } from "./tmdbConfig.js";
import {
    auth,
    db,
    loginWithGoogle,
    loginAnonymously,
    logout,
    watchAuthState,
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
} from "./config.js";

let currentPage = 1;
const key = tmdbConfig.YOUR_API_KEY;
console.log(key);
let favoriteIds = new Set();
/**
 * 映画リストを画面に描画する
 * @param {Array} movies TMDb API から取得した映画オブジェクトの配列
 */
function renderMovies(movies, targetElementID = "#app") {
    let elements = "";

    movies.forEach((m) => {
        // お気に入りかどうか判断
        const isFav = favoriteIds.has(String(m.id));

        elements += `
        <div class="movie-card" data-movie='${JSON.stringify(m)}'>
          <div class="movie-img">
            <img 
              src="https://image.tmdb.org/t/p/w300_and_h450_bestv2/${
                  m.poster_path
              }" 
              alt="${m.title}"
            />
          </div>
          <p>${m.title}</p>
          <div class="card-items">
            <p>★${m.vote_average.toFixed(1)}</p>
            <p>|</p>
            <p>📝${m.vote_count}</p>
            <p>|</p>
            <button class="favorite-btn" data-id="${m.id}">
              ${isFav ? "♥" : "♡"}
            </button>
          </div>
        </div>
      `;
    });
    $(targetElementID).html(elements);
}

// 映画表示
function fetchMovies(page) {
    axios
        .get("https://api.themoviedb.org/3/discover/movie", {
            params: {
                api_key: key,
                query: "",
                include_adult: false,
                language: "ja",
                page: page,
                region: "JP",
            },
        })
        .then((response) => {
            const movies = response.data.results;
            renderMovies(movies, "#app");
        })
        .catch((error) => console.error(error));
}

// ページネーション
fetchMovies(currentPage);
$("#next").on("click", function () {
    currentPage++;
    fetchMovies(currentPage);
});
$("#previous").on("click", function () {
    currentPage--;
    fetchMovies(currentPage);
});

// 映画検索
function searchMovies(query) {
    axios
        .get("https://api.themoviedb.org/3/search/movie", {
            params: {
                api_key: key,
                query: query,
                language: "ja",
                page: 1,
                region: "JP",
                include_adult: false,
            },
        })
        .then((response) => {
            const movies = response.data.results;
            if (movies.length === 0) {
                $("#app").html("<p>検索結果がありません</p>");
                return;
            }
            renderMovies(movies, "#app");
        })
        .catch((error) => {
            console.error("検索エラー:", error);
            $("#app").html("<p>エラーが発生しました</p>");
        });
}

// 検索ボタンにイベント
$("#searchBtn").on("click", function () {
    const query = $("#searchInput").val().trim();
    if (query !== "") {
        searchMovies(query);
    }
});
// エンターキーで検索イベント
$("#searchInput").on("keydown", function (event) {
    if (event.key === "Enter") {
        const query = $(this).val().trim();
        if (query !== "") {
            searchMovies(query);
        }
    }
});

// 映画カードクリックで詳細表示
$("#app").on("click", ".movie-card", function (e) {
    // ♡ボタン内クリックなら何もしない
    if ($(e.target).closest(".favorite-btn").length) return;

    const movie = $(this).data("movie");
    $("#detailTitle").text(movie.title);
    $("#detailPoster").attr(
        "src",
        `https://image.tmdb.org/t/p/w300_and_h450_bestv2${movie.poster_path}`
    );
    $("#detailDate").text(movie.release_date);
    $("#detailOverview").text(movie.overview);

    $("#app, nav, header, .pagenation, footer, #favoritesSection").hide();
    $("#detailView").show();
});

// 戻るボタン
$("#backToList").on("click", function () {
    $("#app").show();
    $("header").show();
    $("nav").show();
    $(".pagenation").show();
    $("footer").show();
    $("#detailView").hide();
});

// ログイン
$("#loginGoogle").on("click", loginWithGoogle);
$("#loginAnon").on("click", loginAnonymously);

// お気に入りに入れる
$(document).on("click", ".favorite-btn", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = $(this);
    const movie = btn.closest(".movie-card").data("movie");
    const user = auth.currentUser;

    if (!user) {
        return alert("ログインが必要です");
    }

    // Firestoreでのドキュメント参照の取得
    const userFavDocRef = doc(
        db,
        "favorites",
        user.uid,
        "userFavorites",
        String(movie.id)
    );

    if (favoriteIds.has(String(movie.id))) {
        // お気に入りから削除 (ドキュメントを削除)
        deleteDoc(userFavDocRef)
            .then(() => {
                favoriteIds.delete(String(movie.id));
                btn.text("♡");
                if ($("#favoritesSection").is(":visible")) {
                    fetchFavorites();
                }
            })
            .catch((error) => {
                console.error("お気に入り解除エラー (Firestore):", error);
                alert("お気に入りの解除中にエラーが発生しました。");
            });
    } else {
        // お気に入りに追加 (ドキュメントを設定)
        setDoc(userFavDocRef, {
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            vote_average: movie.vote_average,
            vote_count: movie.vote_count,
            timestamp: Date.now(),
        })
            .then(() => {
                favoriteIds.add(String(movie.id));
                btn.text("♥");
                if ($("#favoritesSection").is(":visible")) {
                    fetchFavorites();
                }
            })
            .catch((error) => {
                console.error("お気に入り登録エラー (Firestore):", error);
                alert("お気に入りの登録中にエラーが発生しました。");
            });
    }
});
// お気に入り一覧
function fetchFavorites() {
    const user = auth.currentUser;

    if (!user) {
        console.warn("ログインしていないため、お気に入りは取得できません");
        $("#favoriteMoviesContainer").html(
            "<p>お気に入りを見るにはログインが必要です。</p>"
        );
        return;
    }

    const uid = user.uid;
    const userFavoritesCollectionRef = collection(
        db,
        "favorites",
        uid,
        "userFavorites"
    );

    // onSnapshot を使ってリアルタイムでお気に入りデータを購読
    onSnapshot(
        userFavoritesCollectionRef,
        (snapshot) => {
            console.log("Firestore からのデータ更新を受信しました。"); // この行を追加
            console.log("Snapshot のドキュメント数:", snapshot.size);
            // ドキュメントの配列を、使いやすいオブジェクト形式に変換
            const favoriteMovies = [];
            snapshot.forEach((doc) => {
                favoriteMovies.push(doc.data());
            });
            console.log("取得したお気に入り映画データ:", favoriteMovies);
            if (favoriteMovies.length === 0) {
                $("#favoriteMoviesContainer").html(
                    "<p>お気に入りの映画はまだありません。</p>"
                );
            } else {
                renderMovies(favoriteMovies, "#favoriteMoviesContainer");
            }
        },
        (error) => {
            console.error("お気に入りデータの取得エラー (Firestore):", error);
            $("#favoriteMoviesContainer").html(
                "<p>お気に入りデータの取得中にエラーが発生しました。</p>"
            );
        }
    );
}

/**
 * ユーザーのお気に入りIDをFirebase (Firestore) から読み込み、favoriteIds Setを更新する
 * @param {string} uid
 * @param {Function} callback
 */
function loadFavoriteIds(uid, callback) {
    const userFavoritesCollectionRef = collection(
        db,
        "favorites",
        uid,
        "userFavorites"
    );

    // onSnapshot を使ってリアルタイムでお気に入りIDを購読
    onSnapshot(
        userFavoritesCollectionRef,
        (snapshot) => {
            const newFavoriteIds = new Set();
            snapshot.forEach((doc) => {
                newFavoriteIds.add(String(doc.id));
            });
            favoriteIds = newFavoriteIds;
            if (callback) callback();
        },
        (error) => {
            console.error("お気に入りIDのロードエラー (Firestore):", error);
        }
    );
}
// ユーザーのログイン状態を監視
watchAuthState((user) => {
    if (user) {
        $("#userStatus").text(
            user.isAnonymous
                ? "匿名ログイン中"
                : `ログイン中：${user.displayName || "ユーザー"}`
        );
        // ログインしたらお気に入りIDを読み込んでから一覧描画
        loadFavoriteIds(user.uid, () => fetchMovies(currentPage));
    } else {
        $("#userStatus").text("ログインしていません");
        favoriteIds.clear();
        fetchMovies(currentPage);
    }
});

// 「映画一覧」ボタンのクリックイベント
$("#showMoviesBtn").on("click", function () {
    $("#favoritesSection, #detailView").hide();
    $("#app, nav, header, .pagenation, footer").show();
    fetchMovies(currentPage);
});

// 「お気に入り」ボタンのクリックイベント
$("#showFavoritesBtn").on("click", function () {
    const user = auth.currentUser;
    if (!user) {
        alert("お気に入りを見るにはログインが必要です。");
        return;
    }
    $("#app, nav, header, .pagenation, footer, #detailView").hide();
    $("#favoritesSection").show();
    fetchFavorites();
});

// お気に入りセクションからの「映画一覧に戻る」ボタンのクリックイベント
$("#backFromFavorites").on("click", function () {
    $("#favoritesSection").hide();
    $("#app, nav, header, .pagenation, footer").show();
    fetchMovies(currentPage);
});
