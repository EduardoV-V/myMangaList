import { useEffect, useState } from "react";
import { FaPencilAlt, FaCheck } from 'react-icons/fa';
import { HashRouter } from "react-router-dom";
import { db } from "./firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import CollectionForm from "./form";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove as sortableArrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';

import { CSS } from '@dnd-kit/utilities';

// teste asdasdads
function SortableCollection({ collection, onCollectionClick, onEditClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: collection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
        onClick={() => onCollectionClick(collection)}
      />
      <h2 className="text-center font-bold mt-3 text-gray-100">{collection.title}</h2>
      <p className="text-center text-sm text-gray-400 mt-1">
        {collection.type === 'single' ? 'Volume Único' : `${collection.volumes.filter(v => v.owned).length}/${collection.volumes.length} volumes`}
      </p>
      
      <a
        href={`/edit-collection/${collection.id}`}
        className="absolute top-3 right-3 bg-gray-900 bg-opacity-80 text-gray-100 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md"
        onClick={(e) => {
          e.stopPropagation();
          onEditClick(collection);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </a>
    </div>
  );
}

function Homepage() {
  const [mangaCollections, setMangaCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [sortOrder, setSortOrder] = useState('alphabetical'); // 'custom' ou 'alphabetical'
  const [isEditingOrder, setIsEditingOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "collections"));
      const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Ordenar alfabeticamente se for a primeira vez
      if (sortOrder === 'alphabetical') {
        data.sort((a, b) => a.title.localeCompare(b.title));
      }
      
      setMangaCollections(data);
    };
    fetchData();
  }, [sortOrder]);

  const toggleOwned = async (colId, volId) => {
    const collectionRef = doc(db, "collections", colId);
    const targetCollection = mangaCollections.find((c) => c.id === colId);

    const updatedVolumes = targetCollection.volumes.map((v) =>
      v.id === volId ? { ...v, owned: !v.owned } : v
    );

    await updateDoc(collectionRef, { volumes: updatedVolumes });

    const updatedCollectionWithNewVolumes = { ...targetCollection, volumes: updatedVolumes };

    setMangaCollections(prevCollections =>
      prevCollections.map(c => (c.id === colId ? updatedCollectionWithNewVolumes : c))
    );

    setSelectedCollection(updatedCollectionWithNewVolumes);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setMangaCollections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return sortableArrayMove(items, oldIndex, newIndex); // <-- usar essa
      });
    }
  };

  const toggleSortOrder = () => {
    if (sortOrder === 'custom') {
      setSortOrder('alphabetical');
      setIsEditingOrder(false);
      const sorted = [...mangaCollections].sort((a, b) => a.title.localeCompare(b.title));
      setMangaCollections(sorted);
    } else {
      setSortOrder('custom');
    }
  };

  const saveCustomOrder = async () => {
    try {
      setIsEditingOrder(false);
    } catch (error) {
      console.error("Erro ao salvar ordem:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 w-full max-w-none">
        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-bold text-center mb-2 text-blue-400">MyMangaList</h1>
          <p className="text-gray-400 mb-6">Loucura</p>
          
          <div className="flex gap-4 mb-6">
            <a
              href="/add-collection"
              className="bg-blue-600 hover:bg-blue-700 text-white! font-bold! px-6 py-3 rounded-lg text-lg transition-colors shadow-lg"
            >
              Adicionar Coleção
            </a>
          </div>
          <div className='flex gap-2 mb-6'>
            <p
              onClick={toggleSortOrder}
              className={`bg-gray-600 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2`}
            >
              Name
              {sortOrder === 'custom' && !isEditingOrder ? <faPencilAlt /> : null}
              {isEditingOrder ? <faCheck /> : null}
            </p>

            {sortOrder === 'custom' && (
              <button
                onClick={() => setIsEditingOrder(!isEditingOrder)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-lg text-lg transition-colors shadow-lg"
              >
                {isEditingOrder ? 'Salvar Ordem' : 'Editar Ordem'}
              </button>
            )}
          </div>

          {isEditingOrder && (
            <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3 mb-4">
              <p className="text-yellow-200 text-sm">
                Arraste e solte para reorganizar as coleções.
              </p>
            </div>
          )}
      </div>

      {/* Main Content */}
      <div className="w-full px-4 py-8">
        {mangaCollections.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-6xl mb-4">📚</div>
            <h2 className="text-xl text-gray-400 mb-2">Nenhuma coleção encontrada</h2>
            <p className="text-gray-500">Comece adicionando sua primeira coleção de mangás!</p>
          </div>
        ) : sortOrder === 'custom' && isEditingOrder ? (
          <div className="flex justify-center">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={mangaCollections} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full max-w-7xl">
                  {mangaCollections.map((col) => (
                    <SortableCollection
                      key={col.id}
                      collection={col}
                      onCollectionClick={setSelectedCollection}
                      onEditClick={(col) => window.location.href = `/edit-collection/${col.id}`}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full max-w-7xl">
              {mangaCollections.map((col) => (
                <div
                  key={col.id}
                  className="bg-gray-800 shadow-lg rounded-xl p-4 cursor-pointer hover:scale-105 transition-transform duration-300 group relative border border-gray-700"
                >
                  <img
                    src={col.coverUrl}
                    alt={col.title}
                    className="rounded-lg mx-auto object-cover shadow-md"
                    style={{ width: "150px", height: "225px" }}
                    onClick={() => setSelectedCollection(col)}
                  />
                  <h2 className="text-center font-bold mt-3 text-gray-100">{col.title}</h2>
                  <p className="text-center text-sm text-gray-400 mt-1">
                    {col.type === 'single' ? 'Volume Único' : `${col.volumes.filter(v => v.owned).length}/${col.volumes.length} volumes`}
                  </p>
                  
                  <a
                    href={`/edit-collection/${col.id}`}
                    className="absolute top-3 right-3 bg-gray-900 bg-opacity-80 text-gray-100 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedCollection && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-100">{selectedCollection.title}</h2>
                <p className="text-gray-400">
                  {selectedCollection.type === 'single' ? 'Volume Único' : 
                    `${selectedCollection.volumes.filter(v => v.owned).length}/${selectedCollection.volumes.length} volumes adquiridos`}
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-100 text-3xl transition-colors"
                onClick={() => setSelectedCollection(null)}
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto flex-grow">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 p-4">
                {selectedCollection.volumes.map((vol) => (
                  <div key={vol.id} className="flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={vol.coverUrl}
                        alt={`Volume ${vol.id}`}
                        className={`rounded-md cursor-pointer object-contain transition-all duration-300 ${
                          vol.owned ? "opacity-100 ring-2 ring-green-500" : "opacity-60 hover:opacity-80"
                        }`}
                        style={{ height: "160px", width: "140px" }}
                        onClick={() => toggleOwned(selectedCollection.id, vol.id)}
                      />
                      {vol.owned && (
                        <div className="absolute bottom-2 right-2 bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md">
                          ✓
                        </div>
                      )}
                    </div>
                    <p className="text-sm mt-2 font-medium text-gray-300">
                      {selectedCollection.type === 'single' ? selectedCollection.title : `Vol. ${vol.id}`}
                    </p>
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
        <Route path="/" element={<Homepage />} />
        <Route path="/add-collection" element={<CollectionForm />} />
        <Route path="/edit-collection/:id" element={<CollectionForm />} />
      </Routes>
    </HashRouter>
  );
}