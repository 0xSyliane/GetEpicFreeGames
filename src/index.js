import puppeteer from 'puppeteer-core';
import fs from 'fs';
import axios from 'axios';
import { spawn } from 'child_process';

// ⚙️ Configurations
const URL_API = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions";
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const COOKIES_FILE = "cookies.json";

// 📌 Fonction pour récupérer les jeux gratuits
async function getFreeGames() {
    console.log("🔍 Catching free games...");
    try {
        const response = await axios.get(URL_API, { headers: { "Accept-Language": "fr-FR" } });
        const freeGames = response.data.data.Catalog.searchStore.elements
            .filter(game => game.price.totalPrice.discountPrice === 0 && game.productSlug)
            .map(game => ({
                title: game.title,
                url: `https://store.epicgames.com/fr/p/${game.productSlug}`
            }));
        return freeGames;
    } catch (error) {
        console.error("❌ Error through catching free games :", error);
        return [];
    }
}

// 📌 Fonction pour sauvegarder les cookies
async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log("✅ Cookies saved !");

    console.log("🔄 auto restart of the script...");
    setTimeout(() => {
        spawn("node", ["./src/index.js"], { stdio: "inherit", shell: true });
    }, 3000);

    process.exit();
}

// 📌 Fonction pour charger les cookies
async function loadCookies(page) {
    if (fs.existsSync(COOKIES_FILE)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
        await page.setCookie(...cookies);
        console.log("✅ Cookies launched succesfully !");
        return true;
    }
    console.log("⚠️ No cookies file.");
    return false;
}

// 📌 Fonction pour ajouter un jeu à la bibliothèque
async function addGameToLibrary(page, gameUrl) {
    console.log(`🎮 Adding the game ${gameUrl} to the library...`);
    await page.goto(gameUrl, { waitUntil: 'networkidle2' });

    try {
        const btnGet = await page.waitForSelector('button:has-text("Obtenir")', { timeout: 5000 });
        if (btnGet) {
            await btnGet.click();
            await page.waitForTimeout(3000);
        }

        const btnOrder = await page.waitForSelector('button:has-text("Passer commande")', { timeout: 5000 });
        if (btnOrder) {
            await btnOrder.click();
            await page.waitForTimeout(3000);
        }

        console.log(`✅ Game added : ${gameUrl}`);
    } catch (error) {
        console.error(`❌ Error for ${gameUrl} :`, error);
    }
}

// 📌 Fonction principale
(async () => {
    const freeGames = await getFreeGames();

    if (freeGames.length === 0) {
        console.log("⚠️ No free games available.");
        return;
    }

    console.log("🆓 Free games available :");
    freeGames.forEach(game => console.log(`- ${game.title}: ${game.url}`));

    // 🔥 Lancement de Chrome
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: false,
    });

    const page = await browser.newPage();

    // 🔑 Gestion des cookies
    const cookiesLoaded = await loadCookies(page);
    if (!cookiesLoaded) {
        console.log("⚠️ No cookies launched, please connect manually.");
        await page.goto("https://store.epicgames.com/fr/", { waitUntil: 'networkidle2' });

        console.log("🔍 Catching cookies...");
        await page.waitForTimeout(30000); // Attente pour la connexion manuelle
        await saveCookies(page);
        return;
    }

    // 🎮 Ajout des jeux
    for (const game of freeGames) {
        await addGameToLibrary(page, game.url);
    }

    await browser.close();
})();
