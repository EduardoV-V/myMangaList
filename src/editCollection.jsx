import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useNavigate, useParams } from "react-router-dom";

export default function EditCollection() {
  const { id } = useParams(); // id da user_collection
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [collectionName, setCollectionName] = useState("");
  const [collectionCover, setCollectionCover] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [volumes, setVolumes] = useState([]);

  useEffect(() => {
    fetchCollection();
  }, []);

  const fetchCollection = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate("/");

    // Busca coleção do usuário
    const { data: userCollection } = await supabase
      .from("user_collections")
      .select(`
        id,
        custom_name,
        custom_cover,
        price_override,
        collection_id
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!userCollection) return navigate("/");

    // Busca coleção raiz
    const { data: rootCollection } = await supabase
      .from("collections")
      .select("title, cover_url")
      .eq("id", userCollection.collection_id)
      .maybeSingle();

    // Busca volumes do usuário
    const { data: userVolumes } = await supabase
      .from("user_volumes")
      .select("id, volume_number, custom_cover")
      .eq("user_collection_id", id)
      .order("volume_number", { ascending: true });

    setCollectionName(userCollection.custom_name || rootCollection.title);
    setCollectionCover(userCollection.custom_cover || rootCollection.cover_url);
    setPriceOverride(userCollection.price_override || "");
    setVolumes(userVolumes || []);

    setLoading(false);
  };

  const handleVolumeCoverChange = (volumeId, value) => {
    setVolumes(prev =>
      prev.map(v =>
        v.id === volumeId ? { ...v, custom_cover: value } : v
      )
    );
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Atualiza coleção
    await supabase
      .from("user_collections")
      .update({
        custom_name: collectionName,
        custom_cover: collectionCover,
        price_override: priceOverride || null
      })
      .eq("id", id)
      .eq("user_id", user.id);

    // Atualiza capas dos volumes
    for (const volume of volumes) {
      await supabase
        .from("user_volumes")
        .update({
          custom_cover: volume.custom_cover || null
        })
        .eq("id", volume.id);
    }

    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 py-10">
      <div className="max-w-5xl mx-auto px-6">

        <h1 className="text-4xl font-bold text-blue-400 mb-8 text-center">
          Editar Coleção
        </h1>

        <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 space-y-6">

          {/* Nome */}
          <div>
            <label className="block mb-2 font-semibold">
              Nome da Coleção
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Capa coleção */}
          <div>
            <label className="block mb-2 font-semibold">
              URL da Capa da Coleção
            </label>
            <input
              type="text"
              value={collectionCover}
              onChange={(e) => setCollectionCover(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Valor individual */}
          <div>
            <label className="block mb-2 font-semibold">
              Valor pago por volume (opcional)
            </label>
            <input
              type="number"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

        </div>

        {/* Volumes */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold mb-6 text-blue-300">
            Capas Individuais dos Volumes
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {volumes.map(volume => (
              <div
                key={volume.id}
                className="bg-gray-800 p-5 rounded-xl border border-gray-700"
              >
                <p className="font-semibold mb-2">
                  Volume {volume.volume_number}
                </p>

                <input
                  type="text"
                  value={volume.custom_cover || ""}
                  onChange={(e) =>
                    handleVolumeCoverChange(volume.id, e.target.value)
                  }
                  placeholder="URL da capa personalizada"
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-between mt-12">

          <button
            onClick={() => navigate("/")}
            className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-500 px-8 py-3 rounded-lg font-semibold"
          >
            Salvar Alterações
          </button>

        </div>

      </div>
    </div>
  );
}