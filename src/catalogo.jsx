import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { useNavigate } from "react-router-dom";

export default function Catalog() {
  const [collections, setCollections] = useState([]);
  const [userCollections, setUserCollections] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [page, limit, searchTerm]);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("collections")
      .select("id, title, cover_url", { count: "exact" })
      .order("title", { ascending: true })
      .range(from, to);

    if (searchTerm.trim() !== "") {
      query = query.ilike("title", `%${searchTerm}%`);
    }

    const { data, count } = await query;

    const { data: userCols } = await supabase
      .from("user_collections")
      .select("collection_id")
      .eq("user_id", user.id);

    setCollections(data || []);
    setUserCollections(userCols?.map(c => c.collection_id) || []);
    setTotalCount(count || 0);
  };

  const importCollection = async (collectionId) => {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("user_collections").insert({
      user_id: user.id,
      collection_id: collectionId
    });

    fetchData();
  };

  const removeCollection = async (collectionId) => {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("user_collections")
      .delete()
      .eq("user_id", user.id)
      .eq("collection_id", collectionId);

    fetchData();
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">

        {/* HEADER + BUSCA */}
        <div className="mb-8">

          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => navigate("/")}
              className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-600"
            >
              ← Voltar
            </button>

            <h1 className="text-4xl font-bold text-blue-400 text-center">
              Catálogo Global
            </h1>

            <button
              onClick={() => navigate("/add-form")}
              className="bg-green-600 px-4 py-2 rounded hover:bg-green-500"
            >
              + Sugerir Coleção
            </button>
          </div>

          {/* Barra de busca alinhada com grid */}
          <div className="w-full flex flex-col md:flex-row gap-4 items-center">

            <input
              type="text"
              placeholder="Buscar coleção pelo nome..."
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="flex-1 px-4 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            />

            <select
              value={limit}
              onChange={(e) => {
                setPage(1);
                setLimit(Number(e.target.value));
              }}
              className="px-4 py-2 rounded bg-gray-800 border border-gray-700"
            >
              <option value={20}>20 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>

          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          {collections.map(col => {
            const alreadyAdded = userCollections.includes(col.id);

            return (
              <div
                key={col.id}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col"
              >
                <img
                  src={col.cover_url}
                  alt={col.title}
                  loading="lazy"
                  className="rounded-lg mx-auto"
                  style={{ width: "150px", height: "225px" }}
                />

                <h2 className="text-center font-bold mt-3 min-h-[48px]">
                  {col.title}
                </h2>

                <div className="mt-auto">
                  {alreadyAdded ? (
                    <button
                      onClick={() => removeCollection(col.id)}
                      className="mt-3 w-full py-2 rounded !bg-red-600 hover:bg-red-500"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      onClick={() => importCollection(col.id)}
                      className="mt-3 w-full py-2 rounded bg-blue-600 hover:bg-blue-500"
                    >
                      Importar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-10">

            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 bg-gray-700 rounded disabled:opacity-40"
            >
              {"<"}
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 rounded ${
                  page === i + 1
                    ? "bg-blue-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {i + 1}
              </button>
            ))}

            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 bg-gray-700 rounded disabled:opacity-40"
            >
              {">"}
            </button>

          </div>
        )}

      </div>
    </div>
  );
}