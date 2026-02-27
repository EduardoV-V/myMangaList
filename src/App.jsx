import { useEffect, useState } from "react";
import {
  FaArrowDown,
  FaArrowUp,
  FaPencilAlt,
  FaCheck
} from "react-icons/fa";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Link
} from "react-router-dom";
import { supabase } from "./supabase.js";

import CollectionForm from "./form";
import Layout from "./layout"
import Profile from "./profile"
import Catalog from "./catalogo"
import EditCollection from "./editCollection";
import ProtectedRoute from "./protectRoute";
import Login from "./login"
import ProtectedAdminRoute from "./protectAdmin";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";

import {
  arrayMove as sortableArrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import AdminPanel from "./admin";

const calculateCollectionTotal = (collection) => {
  let total = 0;
  for (const v of collection.volumes || []) {
    if (!v.is_owned) continue;
    if (v.price_paid != null) {
      total += Number(v.price_paid);
    } else if (collection.price_override != null) { // Usa price_override
      total += Number(collection.price_override);
    } else if (collection.coverPrice != null) {
      total += Number(collection.coverPrice);
    }
  }
  return total;
};

function SortSelector({
  sortOrder,
  setSortOrder,
  isEditingOrder,
  setIsEditingOrder,
  onSaveOrder,
  orderAsc,
  setOrderAsc
}) {
  const toggleMode = () => {
    setSortOrder(sortOrder === "alphabetical" ? "custom" : "alphabetical");
    setIsEditingOrder(false);
  };

  const toggleAction = () => {
    if (sortOrder === "alphabetical") {
      setOrderAsc(!orderAsc);
    } else {
      if (isEditingOrder) onSaveOrder();
      setIsEditingOrder(!isEditingOrder);
    }
  };

  return (
    <div className="flex items-center gap-2 mb-6 w-full max-w-7xl mx-auto px-4">
      <button
        className="text-lg font-medium text-white! font-bold! hover:text-blue-400! transition! bg-transparent! border-0! p-0!"
        onClick={toggleMode}
      >
        {sortOrder === "alphabetical" ? "Nome" : "Personalizada"}
      </button>
      <button
        className="text-white hover:text-blue-400! transition! bg-transparent! border-0! p-0!"
        onClick={toggleAction}
      >
        {sortOrder === "alphabetical" ? (
          orderAsc ? <FaArrowDown /> : <FaArrowUp />
        ) : isEditingOrder ? (
          <FaCheck />
        ) : (
          <FaPencilAlt />
        )}
      </button>
    </div>
  );
}

function SortableCollection({ collection, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: collection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-gray-800 shadow-lg rounded-xl p-4 cursor-pointer hover:scale-105 transition-transform duration-300 group relative border border-gray-700"
    >
      <img
        src={collection.coverUrl}
        alt={collection.title}
        className="rounded-lg mx-auto object-cover shadow-md"
        style={{ width: "150px", height: "225px" }}
        onClick={() => onClick(collection)}
      />
      <h2 className="text-center font-bold mt-3 text-gray-100">
        {collection.title}
      </h2>
      <p className="text-center text-xs text-gray-400 mt-1">
        {collection.type === "single"
          ? "Volume Único"
          : `${collection.volumes.filter(v => v.is_owned).length}/${collection.volumes.length} volumes`}
      </p>
      <Link
        to={`/edit-collection/${collection.id}`}
        className="absolute top-2 right-2 bg-gray-900 bg-opacity-80 text-gray-100 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <FaPencilAlt className="h-3 w-3" />
      </Link>
    </div>
  );
}

function Homepage() {
  const [user, setUser] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [sortOrder, setSortOrder] = useState("alphabetical");
  const [orderAsc, setOrderAsc] = useState(true);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [processingVolumes, setProcessingVolumes] = useState(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    init();
  }, [sortOrder, orderAsc]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUser(user);
    await fetchCollections(user.id);
  };

  const fetchCollections = async (userId) => {
    // Busca coleções do usuário
    const { data: userCols } = await supabase
      .from("user_collections")
      .select("collection_id")
      .eq("user_id", userId);

    if (!userCols || userCols.length === 0) {
      setCollections([]);
      return;
    }

    const ids = userCols.map(c => c.collection_id);

    // Busca dados das coleções
    const { data: cols } = await supabase
      .from("collections")
      .select("*")
      .in("id", ids);

    // Busca dados personalizados das coleções - CORRIGIDO
    const { data: userCollectionData } = await supabase
      .from("user_collection_data")
      .select("*")
      .eq("user_id", userId)
      .in("collection_id", ids);

    const collectionDataMap = {};
    userCollectionData?.forEach(data => {
      collectionDataMap[data.collection_id] = data;
    });

    // Busca volumes
    const { data: volumes } = await supabase
      .from("volumes")
      .select("*")
      .in("collection_id", ids);

    // Busca dados dos volumes do usuário
    const { data: userVolumes } = await supabase
      .from("user_volumes")
      .select("volume_id, price_paid, custom_cover, is_owned")
      .eq("user_id", userId);

    const userVolumesMap = {};
    userVolumes?.forEach(v => {
      userVolumesMap[v.volume_id] = {
        price_paid: v.price_paid,
        custom_cover: v.custom_cover,
        is_owned: v.is_owned
      };
    });

    let formatted = cols.map(col => {
      const userData = collectionDataMap[col.id] || {}; // Dados personalizados da coleção

      const colVolumes = volumes
        .filter(v => v.collection_id === col.id)
        .sort((a, b) => a.volume_number - b.volume_number)
        .map(v => {
          const volumeData = userVolumesMap[v.id] || {};
          return {
            id: v.id,
            coverUrl: volumeData.custom_cover || v.cover_url,
            originalCoverUrl: v.cover_url,
            is_owned: volumeData.is_owned || false,
            price_paid: volumeData.price_paid ?? null
          };
        });

      return {
        id: col.id,
        title: userData.custom_name || col.title, // Usa nome personalizado
        originalTitle: col.title,
        coverUrl: userData.custom_cover || col.cover_url, // Usa capa personalizada
        originalCoverUrl: col.cover_url,
        type: col.type,
        coverPrice: col.cover_price,
        price_override: userData.price_override, // Usa price_override personalizado
        volumes: colVolumes
      };
    });

    if (sortOrder === "alphabetical") {
      formatted.sort((a, b) =>
        orderAsc
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title)
      );
    }

    setCollections(formatted);
  };

  const toggleOwned = async (colId, volId) => {
    if (!user) return;
    
    // Previne cliques múltiplos
    const key = `${colId}-${volId}`;
    if (processingVolumes.has(key)) return;
    setProcessingVolumes(prev => new Set(prev).add(key));

    try {
      const currentVolume = collections
        .find(c => c.id === colId)
        ?.volumes.find(v => v.id === volId);

      if (!currentVolume) return;

      const newIsOwned = !currentVolume.is_owned;

      // Busca dados existentes
      const { data: existing } = await supabase
        .from("user_volumes")
        .select("custom_cover, price_paid")
        .eq("user_id", user.id)
        .eq("volume_id", volId)
        .maybeSingle();

      if (newIsOwned) {
        // Se não existe, cria com valores padrão
        if (!existing) {
          await supabase
            .from("user_volumes")
            .insert({
              user_id: user.id,
              volume_id: volId,
              is_owned: true,
              custom_cover: null,
              price_paid: null
            });
        } else {
          // Se existe, apenas atualiza is_owned
          await supabase
            .from("user_volumes")
            .update({ is_owned: true })
            .eq("user_id", user.id)
            .eq("volume_id", volId);
        }
      } else {
        // Remove ou marca como não owned
        await supabase
          .from("user_volumes")
          .update({ is_owned: false })
          .eq("user_id", user.id)
          .eq("volume_id", volId);
      }

      // Atualiza estado local
      const updatedCollections = collections.map(col => {
        if (col.id !== colId) return col;
        return {
          ...col,
          volumes: col.volumes.map(v =>
            v.id === volId
              ? { ...v, is_owned: newIsOwned }
              : v
          )
        };
      });

      setCollections(updatedCollections);

      if (selectedCollection?.id === colId) {
        const updatedSelected = updatedCollections.find(c => c.id === colId);
        setSelectedCollection(updatedSelected);
      }
    } catch (error) {
      console.error("Erro ao toggle owned:", error);
    } finally {
      setProcessingVolumes(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const totalSpent = collections.reduce(
    (sum, col) => sum + calculateCollectionTotal(col),
    0
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 w-full">
      <div className="w-full flex flex-col items-center px-4">
        <div className="max-w-7xl w-full">
          <h1 className="text-4xl font-bold text-center mb-2 text-blue-400">
            MyMangaList
          </h1>
          <p className="text-center text-lg text-gray-300 mb-4">
            Total investido: R$ {totalSpent.toFixed(2)}
          </p>
          <div className="flex items-center gap-2 flex-shrink">
            <SortSelector
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              isEditingOrder={isEditingOrder}
              setIsEditingOrder={setIsEditingOrder}
              onSaveOrder={() => {}}
              orderAsc={orderAsc}
              setOrderAsc={setOrderAsc}
            />
            <Link
              to="/catalog"
              className="ml-auto bg-blue-600 hover:bg-blue-700 !text-white px-5 py-3 rounded-lg !shadow-md !transition !whitespace-nowrap !flex-shrink-0"
            >
              <strong>Importar do Catálogo</strong>
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-8 flex justify-center">
        <div className="grid grid-cols-2 min-[500px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 w-full max-w-7xl">
          {collections.map(col => (
            <SortableCollection
              key={col.id}
              collection={col}
              onClick={setSelectedCollection}
            />
          ))}
        </div>
      </div>

      {selectedCollection && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700 shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-700 pb-6 mb-4">
              <div className="flex-1 pr-6">
                <h2 className="text-2xl font-bold text-gray-100">
                  {selectedCollection.title}
                </h2>
                <p className="text-gray-400">
                  {selectedCollection.type === "single"
                    ? "Volume Único"
                    : `${selectedCollection.volumes.filter(v => v.is_owned).length}/${selectedCollection.volumes.length} volumes adquiridos`}
                </p>
                <p className="text-gray-300 mt-2 font-semibold">
                  Total desta coleção: R$ {calculateCollectionTotal(selectedCollection).toFixed(2)}
                </p>
              </div>
              {selectedCollection.coverUrl && (
                <img
                  src={selectedCollection.coverUrl}
                  alt="Capa da coleção"
                  className="hidden md:block w-36 h-52 object-cover rounded-md shadow-lg border border-gray-700"
                />
              )}
              <button
                className="text-gray-400 hover:text-gray-100 text-3xl transition-colors ml-4"
                onClick={() => setSelectedCollection(null)}
              >
                &times;
              </button>
            </div>
            <div className="overflow-y-auto flex-grow">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-4">
                {selectedCollection.volumes.map(vol => (
                  <div key={vol.id} className="flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={vol.coverUrl}
                        alt={`Volume ${vol.id}`}
                        className={`rounded-md cursor-pointer object-contain transition-all duration-300 ${
                          vol.is_owned
                            ? "opacity-100 ring-2 ring-green-500"
                            : "opacity-60 hover:opacity-80"
                        }`}
                        style={{ height: "160px" }}
                        onClick={() =>
                          toggleOwned(selectedCollection.id, vol.id)
                        }
                      />
                      {vol.is_owned && (
                        <div className="absolute bottom-2 right-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md">
                          ✓
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={
            <ProtectedRoute>
              <Homepage />
            </ProtectedRoute>
          } />
          <Route path="/add-collection" element={
            <ProtectedRoute>
              <CollectionForm />
            </ProtectedRoute>
          } />
          <Route path="/edit-collection/:id" element={
            <ProtectedRoute>
              <EditCollection />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/catalog" element={
            <ProtectedRoute>
              <Catalog />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedAdminRoute>
              <AdminPanel />
            </ProtectedAdminRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}