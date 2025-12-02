const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

// --- Variáveis de Estado ---
let gameTime = null;
let realTime = null;
let rate = 1; 

// --- Carregamento de Dados ---
if (fs.existsSync('tempo.json')) {
    try {
        const data = JSON.parse(fs.readFileSync('tempo.json'));
        
        // CORREÇÃO: Tenta converter para Date e verifica validade.
        const loadedGameTime = data.gameTime ? new Date(data.gameTime) : null;
        const loadedRealTime = data.realTime ? new Date(data.realTime) : null;
        
        if (loadedGameTime && !isNaN(loadedGameTime.getTime())) {
            gameTime = loadedGameTime;
        }
        if (loadedRealTime && !isNaN(loadedRealTime.getTime())) {
            realTime = loadedRealTime;
        }
        
        rate = data.rate ?? 1;

    } catch (e) {
        console.error("Erro ao carregar tempo.json. Iniciando com valores padrão.", e);
        // Se houver erro de parsing, as variáveis ficam como null (padrão inicial)
    }
}

// --- Funções Auxiliares ---

// Salva o estado atual no arquivo
function save() {
    fs.writeFileSync('tempo.json', JSON.stringify({
        // Salva as datas como strings ISO, que podem ser reconstruídas
        gameTime: gameTime ? gameTime.toISOString() : null,
        realTime: realTime ? realTime.toISOString() : null,
        rate
    }));
}

// Calcula tempo atual do jogo
function getCurrentGameTime() {
    // CORREÇÃO: Primeira verificação para evitar o erro de cálculo
    if (!gameTime || !realTime || isNaN(gameTime.getTime()) || isNaN(realTime.getTime())) {
        return "Horário não configurado. Use /sethora primeiro.";
    }

    const now = new Date();
    
    // Calcula a diferença de tempo real em segundos
    const diffReal = (now.getTime() - realTime.getTime()) / 1000;
    
    // Se o tempo real não passou, o tempo de jogo também não muda
    if (diffReal <= 0) {
        return gameTime.toTimeString().split(' ')[0];
    }
    
    // Calcula o quanto de tempo de jogo passou (diffReal * rate)
    const gameDiff = diffReal * rate * 1000; // * 1000 para converter para milissegundos
    
    // Calcula o tempo final do jogo
    const final = new Date(gameTime.getTime() + gameDiff);

    return final.toTimeString().split(' ')[0];
}

// --- Discord Bot ---

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', () => {
    console.log(`Bot iniciado como ${client.user.tag}`);
});

// Registrar /sethora e /horaagora e /atualizar
const commands = [
    new SlashCommandBuilder()
        .setName("sethora")
        .setDescription("Define o horário atual do servidor RP")
        .addStringOption(o => o.setName("hora").setDescription("Ex: 12:35").setRequired(true)),

    new SlashCommandBuilder()
        .setName("atualizar")
        .setDescription("Informa o novo horário para calcular a velocidade do tempo")
        .addStringOption(o => o.setName("hora").setDescription("Ex: 12:40").setRequired(true)),

    new SlashCommandBuilder()
        .setName("horaagora")
        .setDescription("Mostra o horário atual do servidor RP")
];

// --- Registro de Comandos e Login ---

(async () => {
    try {
        // ATENÇÃO: Se você está usando client.login("TOKEN"), você precisa definir process.env.TOKEN e process.env.CLIENT_ID 
        // ou substituir por valores diretos. Vou usar os valores do seu código como exemplo.
        const BOT_TOKEN = "MTQ0NTM5MDkzMTM4MDY3MDU2Ng.G13VGw.eTWkDqbpF9klSUJD8G9wYJhQYezu4Cdhu43cNQ";
        // Você precisa do ID do seu aplicativo para registrar comandos globais:
        // Se você não souber, substitua 'SEU_CLIENT_ID' pelo ID real do seu Bot.
        const CLIENT_ID = '1445390931380670566'; 

        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        
        // CORREÇÃO: Usando a variável CLIENT_ID
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log("Comandos registrados com sucesso!");
    } catch (error) {
        console.error("Erro ao registrar comandos:", error);
    }
})();

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.commandName;

    // --- Lógica do /sethora ---
    if (cmd === "sethora") {
        const hora = interaction.options.getString("hora");
        const [h, m] = hora.split(":");
        
        // Verifica se o formato é válido
        if (isNaN(h) || isNaN(m)) {
            return interaction.reply({ content: "⚠️ Formato de hora inválido. Use o formato HH:MM (Ex: 12:35).", ephemeral: true });
        }

        // Cria uma nova data baseada na data/hora atual (apenas para ano/mês/dia)
        const now = new Date();
        now.setHours(h, m, 0, 0); // Define a hora e minuto fornecidos
        
        gameTime = now;
        realTime = new Date();
        rate = 1; // Reseta a velocidade para 1x

        save();

        return interaction.reply(`✔ Horário definido como **${hora}** e velocidade resetada para **1.00x**!`);
    }

    // --- Lógica do /atualizar ---
    if (cmd === "atualizar") {
        if (!gameTime || !realTime) {
            return interaction.reply({ content: "⚠️ Use /sethora primeiro para definir o ponto de partida.", ephemeral: true });
        }
        
        const hora = interaction.options.getString("hora");
        const [h, m] = hora.split(":");

        // Verifica se o formato é válido
        if (isNaN(h) || isNaN(m)) {
            return interaction.reply({ content: "⚠️ Formato de hora inválido. Use o formato HH:MM (Ex: 12:40).", ephemeral: true });
        }

        const nowGame = new Date();
        nowGame.setHours(h, m, 0, 0);

        const nowReal = new Date();
        
        // Calcula a diferença em segundos (milisegundos/1000)
        const diffReal = (nowReal.getTime() - realTime.getTime()) / 1000;
        const diffGame = (nowGame.getTime() - gameTime.getTime()) / 1000;

        // Evita divisão por zero se o tempo real não passou o suficiente
        if (diffReal <= 0 || diffGame <= 0) {
            return interaction.reply({ content: "⚠️ O tempo real ou o tempo de jogo não avançaram o suficiente para calcular uma nova taxa.", ephemeral: true });
        }
        
        rate = diffGame / diffReal;

        gameTime = nowGame;
        realTime = nowReal;

        save();

        return interaction.reply(`🔧 Nova velocidade calculada: **${rate.toFixed(2)}x**`);
    }

    // --- Lógica do /horaagora ---
    if (cmd === "horaagora") {
        // Chama a função corrigida
        const currentTime = getCurrentGameTime();
        return interaction.reply(`🕒 Horário do servidor RP: **${currentTime}**`);
    }
});

// --- Login Final ---
// O seu token REAL: MTQ0NTM5MDkzMTM4MDY3MDU2Ng.G13VGw.eTWkDqbpF9klSUJD8G9wYJhQYezu4Cdhu43cNQ
client.login("MTQ0NTM5MDkzMTM4MDY3MDU2Ng.G13VGw.eTWkDqbpF9klSUJD8G9wYJhQYezu4Cdhu43cNQ");
