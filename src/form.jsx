import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase.js";

const normalizeCollectionName = (name) => {
  return name
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

  /* ------------------ salvar ------------------ */

  const saveCollection = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Você precisa estar logado.");
        return;
      }

      const coverPriceValue = parsePrice(formData.coverPrice);

      // 1️⃣ Criar coleção
      const { data: collectionInserted, error: collectionError } =
        await supabase
          .from("collections")
          .insert({
            slug: normalizeCollectionName(formData.title),
            title: formData.title,
            cover_url: formData.coverUrl,
            type: collectionType === "single" ? "single" : "collection",
            cover_price: coverPriceValue,
          })
          .select()
          .single();

      if (collectionError) throw collectionError;

      // 2️⃣ Relacionar coleção ao usuário
      const { error: userCollectionError } = await supabase
        .from("user_collections")
        .insert({
          user_id: user.id,
          collection_id: collectionInserted.id,
        });

      if (userCollectionError) throw userCollectionError;

      // 3️⃣ Inserir volumes
      if (collectionType === "multi" && formData.volumes.length > 0) {
        const volumesToInsert = formData.volumes.map((v, index) => ({
          collection_id: collectionInserted.id,
          volume_number: index + 1,
          title: v.title,
          cover_url: v.coverUrl,
          cover_price: parsePrice(v.pricePaid),
        }));

        const { data: volumesInserted, error: volumesError } =
          await supabase.from("volumes").insert(volumesToInsert).select();

        if (volumesError) throw volumesError;

        // 4️⃣ Relacionar volumes pagos
        const paidVolumes = volumesInserted
          .filter((v, i) => parsePrice(formData.volumes[i].pricePaid))
          .map((v, i) => ({
            user_id: user.id,
            volume_id: v.id,
            price_paid: parsePrice(formData.volumes[i].pricePaid),
          }));

        if (paidVolumes.length > 0) {
          const { error: paidError } = await supabase
            .from("user_volumes")
            .insert(paidVolumes);

          if (paidError) throw paidError;
        }
      }

      navigate("/");
    } catch (error) {
      console.error("Erro ao salvar coleção:", error);
      alert("Erro ao salvar coleção. Veja o console.");
    }
  };

  /* ------------------ render ------------------ */

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 w-full py-8">
      <div className="flex justify-center w-full px-4">
        <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-blue-400">
              Adicionar Nova Coleção
            </h2>
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
                <label>
                  <input
                    type="radio"
                    checked={collectionType === "multi"}
                    onChange={() => setCollectionType("multi")}
                    className="mr-2"
                  />
                  Múltiplos Volumes
                </label>
                <label>
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
                Nome da Coleção
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md"
              />
            </div>

            {/* Capa */}
            <div>
              <label className="block text-sm mb-2">
                Link da Capa
              </label>
              <input
                type="text"
                name="coverUrl"
                value={formData.coverUrl}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md"
              />
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
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md"
              />
            </div>

            {/* Volumes */}
            {collectionType === "multi" && (
              <div>
                <div className="flex justify-between mb-4">
                  <h3 className="text-lg">Volumes</h3>
                  <button
                    onClick={addNewVolume}
                    className="bg-blue-600 px-3 py-2 rounded-md"
                  >
                    + Adicionar Volume
                  </button>
                </div>

                {formData.volumes.map((volume, index) => (
                  <div
                    key={index}
                    className="border border-gray-700 rounded-lg p-4 mb-4"
                  >
                    <div className="flex justify-between mb-2">
                      <h4>Volume {volume.id}</h4>
                      <button
                        onClick={() => removeVolume(index)}
                        className="text-red-400"
                      >
                        Remover
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Nome do Volume"
                      value={volume.title}
                      onChange={(e) =>
                        handleVolumeChange(index, "title", e.target.value)
                      }
                      className="w-full mb-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                    />

                    <input
                      type="text"
                      placeholder="Link da Capa"
                      value={volume.coverUrl}
                      onChange={(e) =>
                        handleVolumeChange(index, "coverUrl", e.target.value)
                      }
                      className="w-full mb-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                    />

                    <input
                      type="text"
                      placeholder="Valor Pago"
                      value={volume.pricePaid}
                      onChange={(e) =>
                        handleVolumeChange(index, "pricePaid", e.target.value)
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Botão */}
            <div className="flex justify-end">
              <button
                onClick={saveCollection}
                className="px-6 py-2 bg-blue-600 rounded-md"
                disabled={!formData.title || !formData.coverUrl}
              >
                Salvar Coleção
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}