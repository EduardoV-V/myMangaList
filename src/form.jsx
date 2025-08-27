import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./firebase";
import { doc, setDoc, getDoc, updateDoc, addDoc, collection, deleteDoc } from "firebase/firestore";
import { defaultNewIndexGetter } from "@dnd-kit/sortable";

const normalizeCollectionName = (name) => {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export default function CollectionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collectionType, setCollectionType] = useState('multi');
  const [formData, setFormData] = useState({
    title: "",
    coverUrl: "",
    type: "collection",
    volumes: []
  });

  useEffect(() => {
    if (id) {
      const fetchCollection = async () => {
        const docRef = doc(db, "collections", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({ id: docSnap.id, ...data });
          setCollectionType(data.type === 'single' ? 'single' : 'multi');
        }
      };
      fetchCollection();
    }
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVolumeChange = (index, field, value) => {
    const updatedVolumes = [...formData.volumes];
    updatedVolumes[index] = {
      ...updatedVolumes[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      volumes: updatedVolumes
    }));
  };

  const addNewVolume = () => {
    setFormData(prev => ({
      ...prev,
      volumes: [
        ...prev.volumes,
        { id: prev.volumes.length + 1, title: "", coverUrl: "", owned: false }
      ]
    }));
  };

  const removeVolume = (index) => {
    const updatedVolumes = formData.volumes
      .filter((_, i) => i !== index)
      .map((volume, newIndex) => ({
        ...volume,
        id: newIndex + 1
      }));
      
    setFormData(prev => ({
      ...prev,
      volumes: updatedVolumes
    }));
  };

  const saveCollection = async () => {
    try {
      const collectionId = normalizeCollectionName(formData.title);
      
      const collectionData = {
        ...formData,
        type: collectionType === 'single' ? 'single' : 'collection',
      };

      if (id) {
        // Atualiza coleção existente
        const collectionRef = doc(db, "collections", id);
        await updateDoc(collectionRef, collectionData);
      } else {
        // Cria nova coleção com ID normalizado
        const collectionRef = doc(db, "collections", collectionId);
        await setDoc(collectionRef, collectionData);
      }
      
      navigate("/");
    } catch (error) {
      console.error("Erro ao salvar coleção: ", error);
    }
  };

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
                    checked={collectionType === 'multi'}
                    onChange={() => setCollectionType('multi')}
                    className="mr-2"
                  />
                  Múltiplos Volumes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="single"
                    checked={collectionType === 'single'}
                    onChange={() => setCollectionType('single')}
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
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                placeholder="Ex: Chainsaw Man"
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
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                placeholder="https://exemplo.com/capa.jpg"
              />
              {formData.coverUrl && (
                <div className="mt-3">
                  <p className="text-sm text-gray-400 mb-2">Preview da Capa Principal:</p>
                  <img
                    src={formData.coverUrl}
                    alt="Preview da capa"
                    className="h-60 w-44 object-contain border border-gray-600 rounded-md bg-gray-900 mx-auto" // Aumentei o tamanho
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {collectionType === 'multi' ? (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-300">Volumes</h3>
                  <button
                    onClick={addNewVolume}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md transition-colors"
                  >
                    <span className="text-lg mr-1">+</span> Adicionar Volume
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.volumes.map((volume, index) => (
                    <div key={index} className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium text-gray-300">Volume {volume.id}</h4>
                        <button
                          onClick={() => removeVolume(index)}
                          className="text-red-400 hover:text-red-300 transition-colors"
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
                            onChange={(e) => handleVolumeChange(index, 'title', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                            placeholder="Ex: Chainsaw Man #1"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            Link da Capa
                          </label>
                          <div className="flex gap-2 items-start">
                            <input
                              type="text"
                              value={volume.coverUrl}
                              onChange={(e) => handleVolumeChange(index, 'coverUrl', e.target.value)}
                              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100"
                              placeholder="https://exemplo.com/volume1.jpg"
                            />
                            {volume.coverUrl && (
                              <img
                                src={volume.coverUrl}
                                alt="Preview"
                                className="h-16 w-12 object-cover border border-gray-600 rounded ml-2" // Aumentei o tamanho
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          {volume.coverUrl && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-400 mb-1">Preview Grande:</p>
                              <img
                                src={volume.coverUrl}
                                alt="Preview grande"
                                className="h-40 w-28 object-contain border border-gray-600 rounded-md bg-gray-900 mx-auto" // Preview maior
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-gray-700 rounded-lg p-4 bg-gray-750">
                <h3 className="text-lg font-medium text-gray-300 mb-4">Volume Único</h3>
                <p className="text-gray-400 text-sm">
                  Para mangás de volume único, as informações da capa e título já foram preenchidas acima.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t border-gray-700">
              {id && (
                <button
                  onClick={deleteCollection}
                  className="px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-600 transition-colors"
                >
                  Excluir Coleção
                </button>
              )}
              <button
                onClick={saveCollection}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!formData.title || !formData.coverUrl || (collectionType === 'multi' && formData.volumes.length === 0)}
              >
                {id ? "Atualizar" : "Salvar"} Coleção
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}