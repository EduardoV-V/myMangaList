import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

const normalizeCollectionName = (name) => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

// Função para formatar número para string com ponto como separador decimal
const formatNumberForInput = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    // Converte número para string com ponto decimal
    return value.toString().replace(".", ",");
  }
  return value;
};

// Função para converter string para número, tratando vírgula
const parsePrice = (value) => {
  if (!value && value !== 0) return null;
  
  // Se já for número, retorna
  if (typeof value === "number") return value;
  
  // Remove espaços
  let str = String(value).trim();
  if (!str) return null;
  
  // Substitui vírgula por ponto e remove caracteres não numéricos (exceto ponto e vírgula)
  str = str.replace(",", ".");
  
  // Remove múltiplos pontos decimais
  const parts = str.split(".");
  if (parts.length > 2) {
    str = parts[0] + "." + parts.slice(1).join("");
  }
  
  // Converte para número
  const num = parseFloat(str);
  
  // Verifica se é um número válido
  if (isNaN(num) || num < 0) return null;
  
  // Arredonda para 2 casas decimais
  return Math.round(num * 100) / 100;
};

export default function CollectionForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [collectionType, setCollectionType] = useState("multi");

  const [formData, setFormData] = useState({
    title: "",
    coverUrl: "",
    type: "collection",
    coverPrice: "", // armazenamos como string durante edição
    volumes: [],
  });

  /* ------------------ carregar ao editar ------------------ */
  useEffect(() => {
    if (!id) return;
    const fetchCollection = async () => {
      const docRef = doc(db, "collections", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Formata valores numéricos para string com vírgula para exibir no input
        const normalized = {
          ...data,
          coverPrice: formatNumberForInput(data.coverPrice),
          volumes: Array.isArray(data.volumes)
            ? data.volumes.map((v) => ({
                ...v,
                pricePaid: formatNumberForInput(v.pricePaid),
              }))
            : [],
        };

        setFormData({ id: docSnap.id, ...normalized });
        setCollectionType(data.type === "single" ? "single" : "multi");
      }
    };

    fetchCollection();
  }, [id]);

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
          owned: false,
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
      const collectionId = normalizeCollectionName(formData.title);

      // Converte coverPrice usando a função parsePrice
      const coverPriceValue = parsePrice(formData.coverPrice);

      // Prepara volumes convertendo pricePaid
      const volumesPrepared = (formData.volumes || []).map((v) => ({
        ...v,
        pricePaid: parsePrice(v.pricePaid),
      }));

      const collectionData = {
        title: formData.title,
        coverUrl: formData.coverUrl,
        type: collectionType === "single" ? "single" : "collection",
        coverPrice: coverPriceValue, // number ou null
        volumes: volumesPrepared,
      };

      if (id) {
        const collectionRef = doc(db, "collections", id);
        await updateDoc(collectionRef, collectionData);
      } else {
        const collectionRef = doc(db, "collections", collectionId);
        await setDoc(collectionRef, collectionData);
      }

      navigate("/");
    } catch (error) {
      console.error("Erro ao salvar coleção: ", error);
      alert("Erro ao salvar coleção. Veja o console para mais detalhes.");
    }
  };

  /* ------------------ deletar ------------------ */
  const deleteCollection = async () => {
    if (window.confirm("Tem certeza que deseja excluir esta coleção?")) {
      try {
        await deleteDoc(doc(db, "collections", id));
        navigate("/");
      } catch (error) {
        console.error("Erro ao excluir coleção: ", error);
      }
    }
  };

  /* ------------------ render ------------------ */
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 w-full py-8">
      <div className="flex justify-center w-full px-4">
        <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-md p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-blue-400">
              {id ? "Editar Coleção" : "Adicionar Nova Coleção"}
            </h2>
            <button
              onClick={() => navigate("/")}
              className="text-gray-400 hover:text-gray-100 px-4 py-2 rounded-lg transition-colors"
            >
              Home
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Coleção
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="multi"
                    checked={collectionType === "multi"}
                    onChange={() => setCollectionType("multi")}
                    className="mr-2"
                  />
                  Múltiplos Volumes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="single"
                    checked={collectionType === "single"}
                    onChange={() => setCollectionType("single")}
                    className="mr-2"
                  />
                  Volume Único
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome da Coleção
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                placeholder="Ex: One Piece"
              />
              {formData.title && (
                <p className="text-xs text-gray-400 mt-1">
                  ID da coleção: {normalizeCollectionName(formData.title)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Link da Capa
              </label>
              <input
                type="text"
                name="coverUrl"
                value={formData.coverUrl}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                placeholder="https://exemplo.com/capa.jpg"
              />
              {formData.coverUrl && (
                <div className="mt-3">
                  <img
                    src={formData.coverUrl}
                    className="h-60 w-44 object-contain mx-auto border border-gray-600 rounded-md"
                    alt="preview capa"
                  />
                </div>
              )}
            </div>

            {/* VALOR DE CAPA */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor de capa da coleção (opcional)
              </label>
              <input
                type="text" // Alterado de "number" para "text" para aceitar vírgula
                name="coverPrice"
                value={formData.coverPrice ?? ""}
                onChange={handleInputChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                placeholder="Ex: 34,90"
              />
            </div>
            <div className="flex justify-between pt-4 border-t border-gray-700">
              {id && (
                <button
                  onClick={deleteCollection}
                  className="px-4 py-2 !bg-red-700 text-white rounded-md"
                >
                  Excluir Coleção
                </button>
              )}

              <button
                onClick={saveCollection}
                className="px-6 py-2 !bg-blue-600 text-white rounded-md ml-auto"
                disabled={!formData.title || !formData.coverUrl}
              >
                {id ? "Atualizar" : "Salvar"} Coleção
              </button>
            </div>

            {collectionType === "multi" ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-300">Volumes</h3>
                  <button
                    onClick={addNewVolume}
                    className="bg-blue-600 px-3 py-2 rounded-md"
                  >
                    + Adicionar Volume
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.volumes.map((volume, index) => (
                    <div
                      key={index}
                      className="border border-gray-700 rounded-lg p-4 bg-gray-750"
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-300">
                          Volume {volume.id}
                        </h4>
                        <button
                          onClick={() => removeVolume(index)}
                          className="text-red-400"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Nome do Volume
                          </label>
                          <input
                            type="text"
                            value={volume.title}
                            onChange={(e) =>
                              handleVolumeChange(index, "title", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Link da Capa
                          </label>
                          <input
                            type="text"
                            value={volume.coverUrl}
                            onChange={(e) =>
                              handleVolumeChange(index, "coverUrl", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                          />

                          {volume.coverUrl && (
                            <img
                              src={volume.coverUrl}
                              className="h-32 w-24 object-cover border border-gray-600 rounded mt-2 mx-auto"
                              alt="preview volume"
                            />
                          )}
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Valor pago (opcional)
                          </label>
                          <input
                            type="text" // Alterado de "number" para "text" para aceitar vírgula
                            value={volume.pricePaid ?? ""}
                            onChange={(e) =>
                              handleVolumeChange(index, "pricePaid", e.target.value)
                            }
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100"
                            placeholder="Ex: 25,00"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                <h3 className="text-lg font-medium text-gray-300 mb-4">
                  Volume Único
                </h3>
                <p className="text-gray-400 text-sm">
                  Para volume único, o valor pago será o valor de capa (caso preenchido) ou o valor informado em volumes[0] se existir.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}