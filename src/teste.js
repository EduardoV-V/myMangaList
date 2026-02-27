import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  "https://ldvggnyzmhnvneupnmyl.supabase.co",
  "sb_publishable_Lk2HnPS23gDVOUqeDIrsvA_SBaDLeSA"
);

await supabase.auth.signInWithPassword({
  email: "admin@email.com",
  password: "admin"
});

const raw = JSON.parse(
  fs.readFileSync("firebase_export.json")
);

async function importData() {
  console.log("Processando collections...");

  // 1️⃣ Sanitizar collections
  const sanitizedCollections = raw.collections.map(col => ({
    slug: col.id, // usamos o id antigo como slug
    title: col.title,
    cover_url: col.cover_url,
    type: col.type,
    cover_price:
      col.cover_price === "" || col.cover_price == null
        ? null
        : Number(col.cover_price)
  }));

  // 2️⃣ Inserir collections
  const { data: insertedCollections, error: colError } =
    await supabase
      .from("collections")
      .insert(sanitizedCollections)
      .select(); // IMPORTANTE para pegar ids gerados

  if (colError) {
    console.error("Erro ao inserir collections:", colError);
    return;
  }

  console.log("Collections inseridas:", insertedCollections.length);

  // 3️⃣ Criar mapa slug -> uuid
  const collectionMap = {};
  insertedCollections.forEach(col => {
    collectionMap[col.slug] = col.id;
  });

  console.log("Processando volumes...");

  // 4️⃣ Sanitizar volumes
  const sanitizedVolumes = raw.volumes
    .filter(vol => collectionMap[vol.collection_id]) // evita órfãos
    .map(vol => ({
      collection_id: collectionMap[vol.collection_id],
      volume_number: Number(vol.volume_number),
      title: vol.title,
      cover_url: vol.cover_url,
      cover_price: null
    }));

  // 5️⃣ Inserir volumes
  const { error: volError } =
    await supabase
      .from("volumes")
      .insert(sanitizedVolumes);

  if (volError) {
    console.error("Erro ao inserir volumes:", volError);
    return;
  }

  console.log("Volumes inseridos:", sanitizedVolumes.length);
  console.log("Migração finalizada com sucesso 🚀");
}

importData();