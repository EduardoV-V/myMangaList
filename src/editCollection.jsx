import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useNavigate, useParams } from "react-router-dom";

export default function EditCollection() {
  const { id } = useParams(); // collection_id
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collectionCover, setCollectionCover] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [volumes, setVolumes] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCollection();
  }, []);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);

      // Verifica se usuário tem a coleção
      const { data: userCollection, error: userColError } = await supabase
        .from("user_collections")
        .select("collection_id")
        .eq("user_id", user.id)
        .eq("collection_id", id)
        .maybeSingle();

      if (userColError) throw userColError;
      if (!userCollection) {
        navigate("/");
        return;
      }

      // Busca dados personalizados da coleção
      const { data: collectionData, error: colDataError } = await supabase
        .from("user_collection_data")
        .select("*")
        .eq("user_id", user.id)
        .eq("collection_id", id)
        .maybeSingle();

      if (colDataError) throw colDataError;

      // Busca coleção raiz
      const { data: rootCollection, error: rootColError } = await supabase
        .from("collections")
        .select("title, cover_url, cover_price")
        .eq("id", id)
        .maybeSingle();

      if (rootColError) throw rootColError;
      if (!rootCollection) {
        navigate("/");
        return;
      }

      // Busca volumes da coleção
      const { data: rootVolumes, error: volumesError } = await supabase
        .from("volumes")
        .select("id, volume_number, cover_url")
        .eq("collection_id", id)
        .order("volume_number", { ascending: true });

      if (volumesError) throw volumesError;

      // Busca dados personalizados dos volumes
      const { data: userVolumes, error: userVolError } = await supabase
        .from("user_volumes")
        .select("volume_id, price_paid, custom_cover, is_owned")
        .eq("user_id", user.id)
        .in("volume_id", rootVolumes.map(v => v.id));

      if (userVolError) throw userVolError;

      const userVolumesMap = {};
      userVolumes?.forEach(v => {
        userVolumesMap[v.volume_id] = {
          price_paid: v.price_paid,
          custom_cover: v.custom_cover,
          is_owned: v.is_owned
        };
      });

      // Combina dados
      const formattedVolumes = rootVolumes.map(v => ({
        id: v.id,
        volume_number: v.volume_number,
        cover_url: v.cover_url,
        custom_cover: userVolumesMap[v.id]?.custom_cover || "",
        price_paid: userVolumesMap[v.id]?.price_paid || "",
        is_owned: userVolumesMap[v.id]?.is_owned || false
      }));

      setCollectionName(collectionData?.custom_name || rootCollection.title);
      setCollectionCover(collectionData?.custom_cover || rootCollection.cover_url || "");
      setPriceOverride(collectionData?.price_override || rootCollection.cover_price || "");
      setVolumes(formattedVolumes);
      
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      setError("Erro ao carregar dados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleVolumeChange = (volumeId, field, value) => {
    setVolumes(prev =>
      prev.map(v =>
        v.id === volumeId ? { ...v, [field]: value } : v
      )
    );
  };

  const handleSave = async () => {
    if (!user || saving) return;
    
    setSaving(true);
    setError(null);

    try {
      // Salva/Atualiza dados da coleção
      const { error: collectionError } = await supabase
        .from("user_collection_data")
        .upsert({
          user_id: user.id,
          collection_id: id,
          custom_name: collectionName,
          custom_cover: collectionCover,
          price_override: priceOverride ? parseFloat(priceOverride) : null
        }, {
          onConflict: 'user_id, collection_id'
        });

      if (collectionError) throw collectionError;

      // Prepara todas as promises dos volumes
      const volumePromises = volumes.map(volume => {
        const volumeData = {
          user_id: user.id,
          volume_id: volume.id,
          price_paid: volume.price_paid ? parseFloat(volume.price_paid) : null,
          custom_cover: volume.custom_cover || null,
          is_owned: volume.is_owned
        };

        return supabase
          .from("user_volumes")
          .upsert(volumeData, {
            onConflict: 'user_id, volume_id'
          });
      });

      // Executa todas em paralelo
      const results = await Promise.all(volumePromises);
      
      // Verifica se algum volume deu erro
      const failedVolume = results.find(result => result.error);
      if (failedVolume) {
        throw failedVolume.error;
      }

      // Se chegou aqui, tudo deu certo - navega para home
      navigate("/");
      
    } catch (err) {
      console.error("Erro ao salvar:", err);
      setError("Erro ao salvar alterações. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 py-10">
      <div className="max-w-5xl mx-auto px-6">
        <h1 className="text-4xl font-bold text-blue-400 mb-8 text-center">
          Editar Coleção
        </h1>

        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Dados da Coleção */}
        <div className="bg-gray-800 p-8 rounded-xl border border-gray-700 space-y-6 mb-10">
          <h2 className="text-2xl font-bold text-blue-300 mb-4">
            Dados da Coleção
          </h2>

          <div>
            <label className="block mb-2 font-semibold">
              Nome da Coleção
            </label>
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold">
              URL da Capa da Coleção
            </label>
            <div className="flex gap-4 items-start">
              <div className="flex-grow">
                <input
                  type="text"
                  value={collectionCover}
                  onChange={(e) => setCollectionCover(e.target.value)}
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://exemplo.com/capa.jpg"
                  disabled={saving}
                />
              </div>
              {collectionCover && (
                <div className="flex-shrink-0">
                  <img
                    src={collectionCover}
                    alt="Preview da capa"
                    className="w-20 h-28 object-cover rounded-md border border-gray-600"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/80x112?text=Erro";
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block mb-2 font-semibold">
              Preço padrão por volume (R$)
            </label>
            <input
              type="number"
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
              disabled={saving}
            />
            <p className="text-sm text-gray-400 mt-1">
              Este valor será usado como padrão para todos os volumes, a menos que seja especificado individualmente abaixo.
            </p>
          </div>
        </div>

        {/* Volumes */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold mb-6 text-blue-300">
            Volumes da Coleção
          </h2>

          <div className="grid grid-cols-1 gap-6">
            {volumes.map(volume => (
              <div
                key={volume.id}
                className="bg-gray-800 p-5 rounded-xl border border-gray-700"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <img
                      src={volume.custom_cover || volume.cover_url}
                      alt={`Volume ${volume.volume_number}`}
                      className="w-16 h-20 object-cover rounded-md border border-gray-600"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/64x80?text=Erro";
                      }}
                    />
                  </div>

                  <div className="flex-grow space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-lg">
                        Volume {volume.volume_number}
                      </p>
                      <span className={`px-2 py-1 rounded text-xs ${
                        volume.is_owned 
                          ? "bg-green-600 text-white" 
                          : "bg-gray-600 text-gray-300"
                      }`}>
                        {volume.is_owned ? "Adquirido" : "Não adquirido"}
                      </span>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm text-gray-400">
                        URL da capa personalizada
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={volume.custom_cover}
                          onChange={(e) =>
                            handleVolumeChange(volume.id, "custom_cover", e.target.value)
                          }
                          placeholder="https://exemplo.com/capa-personalizada.jpg"
                          className="flex-grow p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={saving}
                        />
                        {volume.custom_cover && (
                          <img
                            src={volume.custom_cover}
                            alt="Preview"
                            className="w-10 h-14 object-cover rounded border border-gray-600"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/40x56?text=Erro";
                            }}
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block mb-1 text-sm text-gray-400">
                        Preço pago (R$)
                      </label>
                      <input
                        type="number"
                        value={volume.price_paid}
                        onChange={(e) =>
                          handleVolumeChange(volume.id, "price_paid", e.target.value)
                        }
                        placeholder="0.00"
                        className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.01"
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-12">
          <button
            onClick={() => navigate("/")}
            className="bg-gray-600 hover:bg-gray-500 px-6 py-3 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`bg-green-600 hover:bg-green-500 px-8 py-3 rounded-lg font-semibold transition-colors ${
              saving ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </span>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}