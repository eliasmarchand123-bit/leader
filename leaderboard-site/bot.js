import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

dotenv.config();

/* =======================
   ENV
======================= */
const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUBMIT_CHANNEL_ID,
  VERIFY_CHANNEL_ID
} = process.env;

const submitChannelId = SUBMIT_CHANNEL_ID || "1492959107236368394";
const verifyChannelId = VERIFY_CHANNEL_ID || "1508121386286186616";

if (
  !DISCORD_TOKEN ||
  !CLIENT_ID ||
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  console.error("❌ Missing .env variables");
  process.exit(1);
}

/* =======================
   SUPABASE
======================= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const parseTimeInput = (timeInput = "") => {
  const raw = String(timeInput || "").trim().toLowerCase();

  if (!raw) return null;

  const normalized = raw
    .replace(/[,;/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Format : 2:42:57 ou 2:42:57.367
  const colonFormat =
    /^([0-9]{1,2})(?::([0-9]{1,2}))?(?::([0-9]{1,2}(?:\.[0-9]{1,3})?))?$/;

  const colonMatch = normalized.match(colonFormat);

  if (colonMatch) {
    const hours = Number(colonMatch[1] || 0);
    const minutes = Number(colonMatch[2] || 0);

    const secondsPart = colonMatch[3] || "0";
    const [seconds, fraction = "0"] = secondsPart.split(".");

    const millis = Number(fraction.padEnd(3, "0").slice(0, 3)) || 0;

    return {
      formatted:
        `${hours ? `${hours}h ` : ""}` +
        `${minutes ? `${minutes}m ` : ""}` +
        `${seconds}s` +
        `${millis ? ` ${millis}ms` : ""}`,

      value:
        hours * 3600000 +
        minutes * 60000 +
        Number(seconds) * 1000 +
        millis
    };
  }

  const tokenRegex =
    /(\d+(?:\.\d+)?)(h|hr|hours|heure|heures|m|min|minute|minutes|s|sec|seconds|secondes|ms|msec|milliseconds|millisecondes)?/gi;

  let match;

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let millis = 0;

  let lastUnit = "";
  let sawValue = false;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    const valueRaw = match[1];
    const unit = (match[2] || "").toLowerCase();

    const value = Number(valueRaw);

    if (Number.isNaN(value)) continue;

    sawValue = true;

    if (unit === "" || unit === undefined) {
      if (lastUnit === "s") {
        millis = value;
      } else if (lastUnit === "m") {
        seconds = seconds || value;
      } else if (lastUnit === "h") {
        minutes = minutes || value;
      } else if (!seconds) {
        seconds = value;
      } else if (!millis) {
        millis = value;
      }

      continue;
    }

    if (["h", "hr", "hours", "heure", "heures"].includes(unit)) {
      hours = value;
      lastUnit = "h";
    } else if (["m", "min", "minute", "minutes"].includes(unit)) {
      minutes = value;
      lastUnit = "m";
    } else if (["s", "sec", "seconds", "secondes"].includes(unit)) {
      seconds = value;
      lastUnit = "s";
    } else if (
      ["ms", "msec", "milliseconds", "millisecondes"].includes(unit)
    ) {
      millis = value;
      lastUnit = "ms";
    }
  }

  if (!sawValue) return null;

  return {
    formatted:
      `${hours ? `${hours}h ` : ""}` +
      `${minutes ? `${minutes}m ` : ""}` +
      `${seconds ? `${seconds}s` : ""}` +
      `${millis ? ` ${millis}ms` : ""}`,

    value:
      hours * 3600000 +
      minutes * 60000 +
      seconds * 1000 +
      millis
  };
};

/* =======================
   DISCORD
======================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* =======================
   COMMANDS
======================= */
const commands = [
  new SlashCommandBuilder()
    .setName("submit_run")
    .setDescription("Submit your run for verification")
    .addStringOption(o =>
      o.setName("player").setDescription("Player name").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("video").setDescription("Video URL").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("date").setDescription("Run date").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("browser").setDescription("Browser used").setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("time")
        .setDescription("Time like 2h42m57s or 2:42:57.367")
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName("version").setDescription("Game version").setRequired(true)
    )
    .addStringOption(o =>
      o.setName("comment").setDescription("Additional run details")
    ),

  new SlashCommandBuilder()
    .setName("approve_run")
    .setDescription("Approve a submitted run")
    .addIntegerOption(o =>
      o.setName("id").setDescription("Run ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("delete_player")
    .setDescription("Delete a player from the leaderboard")
    .addStringOption(o =>
      o
        .setName("player")
        .setDescription("Exact player name")
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o
        .setName("id")
        .setDescription("Optional run ID to remove a single entry")
    )
].map(c => c.toJSON());

/* =======================
   REGISTER
======================= */
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);

async function register() {
  try {
    await rest.put(route, { body: commands });
    console.log("✅ Commands registered");
  } catch (e) {
    console.error("❌ Command register error:", e);
  }
}

/* =======================
   READY
======================= */
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* =======================
   INTERACTIONS
======================= */
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  /* =======================
     SUBMIT RUN
  ======================= */
  if (i.commandName === "submit_run") {
    if (i.channelId !== submitChannelId) {
      return i.reply({
        content: `❌ Please use this command in <#${submitChannelId}> only.`,
        ephemeral: true
      });
    }

    const video = i.options.getString("video");
    const player = i.options.getString("player");
    const date = i.options.getString("date");
    const browser = i.options.getString("browser");
    const timeInput = i.options.getString("time");
    const version = i.options.getString("version");
    const comment = i.options.getString("comment");

    const parsedTime = parseTimeInput(timeInput);

    if (!parsedTime) {
      return i.reply({
        content:
          "❌ Format de temps invalide.\n\n" +
          "Exemples valides :\n" +
          "• `2h42m57s367ms`\n" +
          "• `2h42m57s`\n" +
          "• `55min35s454ms`\n" +
          "• `55min35s`\n" +
          "• `35s454ms`\n" +
          "• `35s`\n" +
          "• `2:42:57.367`\n" +
          "• `2:42:57`\n" +
          "• `42:57.367`\n" +
          "• `42:57`",
        ephemeral: true
      });
    }

    const normalizedTime = parsedTime.formatted;

    // Calcul automatique du prochain place
    const { count } = await supabase
      .from("runs")
      .select("*", { count: "exact", head: true })
      .not("verified_by", "is", null);

    const nextPlace = (count || 0) + 1;

    // Insert pending run
    const { data, error } = await supabase
      .from("runs")
      .insert([
        {
          player,
          video,
          date,
          browser,
          place: null,
          time: normalizedTime,
          time_precise: normalizedTime,
          version,
          comment,
          submitted_by: i.user.tag,
          verified_by: null,
          status: "pending"
        }
      ])
      .select("id");

    if (error) {
      console.error(error);

      return i.reply({
        content: `❌ DB error: ${error.message}`,
        ephemeral: true
      });
    }

    const runId = data?.[0]?.id;

    const verificationChannel = await client.channels
      .fetch(verifyChannelId)
      .catch(() => null);

    if (verificationChannel?.isTextBased()) {
      await verificationChannel.send({
        content:
          `📥 Nouvelle run soumise pour vérification :\n\n` +
          `**ID:** ${runId}\n` +
          `**Joueur:** ${player}\n` +
          `**Vidéo:** ${video}\n` +
          `**Date:** ${date}\n` +
          `**Navigateur:** ${browser}\n` +
          `**Place:** ${nextPlace}\n` +
          `**Temps:** ${normalizedTime}\n` +
          `**Version:** ${version}\n` +
          `${comment ? `**Commentaire:** ${comment}\n` : ""}` +
          `**Soumis par:** ${i.user.tag}`
      });
    }

    return i.reply({
      content:
        `✅ Run soumise avec succès.\n` +
        `Elle est maintenant en attente de vérification.`,
      ephemeral: true
    });
  }

  /* =======================
     VERIFY CHANNEL ONLY
  ======================= */
  if (i.channelId !== verifyChannelId) {
    return i.reply({
      content: `❌ Cette commande doit être utilisée dans <#${verifyChannelId}>.`,
      ephemeral: true
    });
  }

  /* =======================
     APPROVE RUN
  ======================= */
  if (i.commandName === "approve_run") {
    const id = i.options.getInteger("id");

    const { data: runRows, error: fetchErr } = await supabase
      .from("runs")
      .select("id, player, time, time_precise")
      .eq("id", id);

    if (fetchErr) {
      return i.reply({
        content: `❌ DB error: ${fetchErr.message}`,
        ephemeral: true
      });
    }

    if (!runRows || runRows.length === 0) {
      return i.reply({
        content: `❌ Run ID ${id} not found.`,
        ephemeral: true
      });
    }

    const run = runRows[0];

    // Delete old approved runs from same player
    const { data: approvedRuns } = await supabase
      .from("runs")
      .select("id")
      .eq("player", run.player)
      .not("id", "eq", id)
      .not("verified_by", "is", null);

    if (approvedRuns?.length) {
      const idsToDelete = approvedRuns.map(r => r.id);

      await supabase
        .from("runs")
        .delete()
        .in("id", idsToDelete);
    }

    // Approve run
    const { error: updateErr } = await supabase
      .from("runs")
      .update({
        verified_by: i.user.tag,
        status: "approved"
      })
      .eq("id", id);

    if (updateErr) {
      return i.reply({
        content: `❌ DB error: ${updateErr.message}`,
        ephemeral: true
      });
    }

    // Refresh leaderboard places
    const { data: allApproved } = await supabase
      .from("runs")
      .select("id, time, time_precise")
      .not("verified_by", "is", null);

    const rowsWithMs = (allApproved || []).map(r => {
      const parsed = parseTimeInput(
        r.time_precise || r.time || ""
      );

      return {
        id: r.id,
        ms: parsed ? parsed.value : 0
      };
    });

    // Fastest first
    rowsWithMs.sort((a, b) => a.ms - b.ms);

    for (let idx = 0; idx < rowsWithMs.length; idx++) {
      const place = idx + 1;

      await supabase
        .from("runs")
        .update({ place })
        .eq("id", rowsWithMs[idx].id);
    }

    return i.reply({
      content:
        `✅ Run ${id} approved.\n` +
        `Leaderboard mis à jour.`,
      ephemeral: true
    });
  }

  /* =======================
     DELETE PLAYER
  ======================= */
  if (i.commandName === "delete_player") {
    const player = i.options.getString("player");
    const id = i.options.getInteger("id");

    let query = supabase.from("runs").delete();

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("player", player);
    }

    const { data, error } = await query.select("id");

    if (error) {
      return i.reply({
        content: `❌ Error deleting run(s).`,
        ephemeral: true
      });
    }

    if (!data || data.length === 0) {
      return i.reply({
        content:
          `❌ Aucun run trouvé pour ${
            id ? `ID ${id}` : player
          }.`,
        ephemeral: true
      });
    }

    return i.reply({
      content:
        `✅ ${data.length} entrée(s) supprimée(s).`,
      ephemeral: true
    });
  }
});

/* =======================
   START
======================= */
await register();

client.login(DISCORD_TOKEN);