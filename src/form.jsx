import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

// Função para gerar slug
const generateSlug = (title) => {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

const parsePrice = (value) => {
  if (!value && value !== 0) return null;
  if (typeof value === "number") return value;
  let str = String(value).trim();
  if (!str) return null;
  str = str.replace(",", ".");
  const parts = str.split(".");
  if (parts.length > 2) {
    str = parts[0] + "." + parts.slice(1).join("");
  }
  const num = parseFloat(str);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
};

export default function CollectionForm() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [collectionType, setCollectionType] = useState("multi");
  const [formData, setFormData] = useState({
    title: "",
    coverUrl: "",
    coverPrice: "",
    volumes: [],
  });

  /* ------------------ handlers ------------------ */

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVolumeChange = (index, field, value) => {
    const updatedVolumes = [...formData.volumes];
    updatedVolumes[index] = {
      ...updatedVolumes[index],
      [field]: value,
    };
    setFormData((prev) => ({
      ...prev,
      volumes: updatedVolumes,
    }));
  };

  const addNewVolume = () => {
    setFormData((prev) => ({
      ...prev,
      volumes: [
        ...prev.volumes,
        {
          id: prev.volumes.length + 1,
          title: "",
          coverUrl: "",
          pricePaid: "",
        },
      ],
    }));
  };

  const removeVolume = (index) => {
    const updatedVolumes = formData.volumes
      .filter((_, i) => i !== index)
      .map((volume, newIndex) => ({
        ...volume,
        id: newIndex + 1,
      }));

    setFormData((prev) => ({
      ...prev,
      volumes: updatedVolumes,
    }));
  };

  /* ------------------ salvar como sugestão ------------------ */

  const saveSuggestion = async () => {
    try {
      setSaving(true);
      
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Você precisa estar logado.");
        return;
      }

      const coverPriceValue = parsePrice(formData.coverPrice);
      const slug = generateSlug(formData.title);

      // Preparar dados dos volumes para o campo JSONB
      const volumesData = collectionType === "multi" 
        ? formData.volumes.map((v, index) => ({
            volume_number: index + 1,
            title: v.title || `Volume ${index + 1}`,
            cover_url: v.coverUrl,
            price_paid: parsePrice(v.pricePaid)
          }))
        : [];

      // 1️⃣ Inserir na pending_collections
      const { data: pendingCollection, error: pendingError } = await supabase
        .from("pending_collections")
        .insert({
          title: formData.title,
          cover_url: formData.coverUrl,
          type: collectionType === "single" ? "single" : "collection",
          cover_price: coverPriceValue,
          created_by: user.id,
          status: "pending",
          volumes_data: volumesData
        })
        .select()
        .single();

      if (pendingError) throw pendingError;

      // 2️⃣ AGORA sim, criar a collection TEMPORÁRIA para o usuário
      const { data: tempCollection, error: tempError } = await supabase
        .from("collections")
        .insert({
          title: formData.title,
          slug: slug + "-temp-" + Date.now(), // Slug único com timestamp
          cover_url: formData.coverUrl,
          type: collectionType === "single" ? "single" : "collection",
          cover_price: coverPriceValue,
        })
        .select()
        .single();

      if (tempError) throw tempError;

      // 3️⃣ Relacionar a coleção temporária ao usuário
      const { error: userCollectionError } = await supabase
        .from("user_collections")
        .insert({
          user_id: user.id,
          collection_id: tempCollection.id,
        });

      if (userCollectionError) throw userCollectionError;

      // 4️⃣ Se tiver volumes, criar também
      if (collectionType === "multi" && formData.volumes.length > 0) {
        const volumesToInsert = formData.volumes.map((v, index) => ({
          collection_id: tempCollection.id,
          volume_number: index + 1,
          title: v.title || `Volume ${index + 1}`,
          cover_url: v.coverUrl,
        }));

        const { data: volumesInserted, error: volumesError } = await supabase
          .from("volumes")
          .insert(volumesToInsert)
          .select();

        if (volumesError) throw volumesError;

        // 5️⃣ Relacionar volumes pagos do usuário
        const paidVolumes = volumesInserted
          .filter((v, i) => parsePrice(formData.volumes[i].pricePaid))
          .map((v, i) => ({
            user_id: user.id,
            volume_id: v.id,
            price_paid: parsePrice(formData.volumes[i].pricePaid),
            custom_cover: null,
            is_owned: true
          }));

        if (paidVolumes.length > 0) {
          const { error: paidError } = await supabase
            .from("user_volumes")
            .insert(paidVolumes);

          if (paidError) throw paidError;
        }
      }

      alert("✅ Sugestão enviada com sucesso! Ela já aparece na sua coleção e aguarda aprovação.");
      navigate("/");
      
    } catch (error) {
      console.error("Erro ao salvar sugestão:", error);
      alert("Erro ao enviar sugestão: " + (error.message || "Verifique o console"));
    } finally {
      setSaving(false);
    }
  };

  /* ------------------ render ------------------ */

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 w-full py-8">
      <div className="flex justify-center w-full px-4">
        <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-blue-400">
                Sugerir Nova Coleção
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Sua sugestão será adicionada imediatamente à sua coleção e poderá ser aprovada para o catálogo global.
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="text-gray-400 hover:text-gray-100 px-4 py-2 rounded-lg transition-colors"
            >
              Home
            </button>
          </div>

          <div className="space-y-6">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Tipo de Coleção
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={collectionType === "multi"}
                    onChange={() => setCollectionType("multi")}
                    className="mr-2"
                  />
                  Múltiplos Volumes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={collectionType === "single"}
                    onChange={() => setCollectionType("single")}
                    className="mr-2"
                  />
                  Volume Único
                </label>
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-sm mb-2">
                Nome da Coleção <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: One Piece, Naruto, etc."
                required
              />
            </div>

            {/* Capa */}
            <div>
              <label className="block text-sm mb-2">
                Link da Capa <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-4 items-start">
                <div className="flex-grow">
                  <input
                    type="text"
                    name="coverUrl"
                    value={formData.coverUrl}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="https://exemplo.com/capa.jpg"
                    required
                  />
                </div>
                {formData.coverUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={formData.coverUrl}
                      alt="Preview da capa"
                      className="w-16 h-20 object-cover rounded-md border border-gray-600"
                      onError={(e) => {
                        e.target.src = "https://via.placeholder.com/64x80?text=Erro";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Valor de capa */}
            <div>
              <label className="block text-sm mb-2">
                Valor de Capa (opcional)
              </label>
              <input
                type="text"
                name="coverPrice"
                value={formData.coverPrice}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="R$ 29,90"
              />
            </div>

            {/* Volumes */}
            {collectionType === "multi" && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Volumes</h3>
                  <button
                    onClick={addNewVolume}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    + Adicionar Volume
                  </button>
                </div>

                {formData.volumes.length === 0 ? (
                  <p className="text-gray-400 text-center py-4 border border-dashed border-gray-700 rounded-lg">
                    Clique em "Adicionar Volume" para começar
                  </p>
                ) : (
                  <div className="space-y-4">
                    {formData.volumes.map((volume, index) => (
                      <div
                        key={index}
                        className="border border-gray-700 rounded-lg p-4 bg-gray-750"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-blue-400">
                            Volume {volume.id}
                          </h4>
                          <button
                            onClick={() => removeVolume(index)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remover
                          </button>
                        </div>

                        <div className="space-y-3">
                          {volume.coverUrl && (
                            <div className="flex items-center gap-2">
                              <img
                                src={volume.coverUrl}
                                alt={`Preview volume ${volume.id}`}
                                className="w-10 h-14 object-cover rounded border border-gray-600"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/40x56?text=Erro";
                                }}
                              />
                              <span className="text-xs text-gray-400">Preview</span>
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="Título do Volume (opcional)"
                            value={volume.title}
                            onChange={(e) =>
                              handleVolumeChange(index, "title", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                          />

                          <input
                            type="text"
                            placeholder="Link da Capa"
                            value={volume.coverUrl}
                            onChange={(e) =>
                              handleVolumeChange(index, "coverUrl", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                          />

                          <input
                            type="text"
                            placeholder="Preço pago (R$) - opcional"
                            value={volume.pricePaid}
                            onChange={(e) =>
                              handleVolumeChange(index, "pricePaid", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botão de envio */}
            <div className="flex justify-end pt-4 border-t border-gray-700">
              <button
                onClick={saveSuggestion}
                disabled={saving || !formData.title || !formData.coverUrl}
                className={`px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors ${
                  (saving || !formData.title || !formData.coverUrl) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Enviando...
                  </span>
                ) : (
                  'Enviar Sugestão'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}