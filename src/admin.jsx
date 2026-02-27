import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useNavigate } from "react-router-dom";
import { 
  FaCheck, 
  FaTimes, 
  FaTrash, 
  FaUserShield,
  FaBook,
  FaLayerGroup,
  FaExclamationTriangle,
  FaUsers,
  FaPlusCircle,
  FaUndo,
  FaEye
} from "react-icons/fa";

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("suggestions");
  const [suggestions, setSuggestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedUserForReset, setSelectedUserForReset] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCollections: 0,
    totalVolumes: 0,
    pendingSuggestions: 0
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const generateSlug = (title) => {
    return title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSuggestions(),
        loadUsers(),
        loadCollections(),
        loadStats()
      ]);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    const { data, error } = await supabase
      .from("pending_collections")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const suggestionsWithEmails = await Promise.all(
      data.map(async (suggestion) => {
        if (!suggestion.created_by) {
          return { ...suggestion, userEmail: "Desconhecido" };
        }
        
        const { data: userData } = await supabase.auth.admin.getUserById(
          suggestion.created_by
        );
        
        return {
          ...suggestion,
          userEmail: userData?.user?.email || "Email não disponível"
        };
      })
    );

    setSuggestions(suggestionsWithEmails || []);
  };

  const loadUsers = async () => {
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("*");

    if (rolesError) throw rolesError;

    const usersWithEmail = await Promise.all(
      rolesData.map(async (role) => {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(
            role.user_id
          );
          
          return {
            id: role.user_id,
            email: userData?.user?.email || "Email não disponível",
            role: role.role
          };
        } catch {
          return {
            id: role.user_id,
            email: "Erro ao carregar",
            role: role.role
          };
        }
      })
    );

    const { data: userCollections } = await supabase
      .from("user_collections")
      .select("user_id");

    const collectionCount = {};
    userCollections?.forEach(uc => {
      collectionCount[uc.user_id] = (collectionCount[uc.user_id] || 0) + 1;
    });

    const formattedUsers = usersWithEmail.map(u => ({
      ...u,
      collectionsCount: collectionCount[u.id] || 0
    }));

    setUsers(formattedUsers || []);
  };

  const loadCollections = async () => {
    const { data, error } = await supabase
      .from("collections")
      .select(`
        *,
        volumes:volumes(count)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted = data?.map(c => ({
      ...c,
      volumesCount: c.volumes?.[0]?.count || 0
    }));

    setCollections(formatted || []);
  };

  const loadStats = async () => {
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id");

    const uniqueUsers = new Set(rolesData?.map(r => r.user_id)).size;

    const { count: totalCollections } = await supabase
      .from("collections")
      .select("*", { count: "exact", head: true });

    const { count: totalVolumes } = await supabase
      .from("volumes")
      .select("*", { count: "exact", head: true });

    const { count: pendingSuggestions } = await supabase
      .from("pending_collections")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    setStats({
      totalUsers: uniqueUsers || 0,
      totalCollections: totalCollections || 0,
      totalVolumes: totalVolumes || 0,
      pendingSuggestions: pendingSuggestions || 0
    });
  };

  const handleApproveSuggestion = async (suggestion) => {
    try {
      const slug = generateSlug(suggestion.title) + "-" + Date.now();

      const { data: newCollection, error: collectionError } = await supabase
        .from("collections")
        .insert({
          title: suggestion.title,
          slug: slug,
          cover_url: suggestion.cover_url,
          type: suggestion.type,
          cover_price: suggestion.cover_price
        })
        .select()
        .single();

      if (collectionError) throw collectionError;

      if (suggestion.volumes_data && suggestion.volumes_data.length > 0) {
        const volumesToInsert = suggestion.volumes_data.map(v => ({
          collection_id: newCollection.id,
          volume_number: v.volume_number,
          title: v.title || `Volume ${v.volume_number}`,
          cover_url: v.cover_url
        }));

        const { error: volumesError } = await supabase
          .from("volumes")
          .insert(volumesToInsert);

        if (volumesError) throw volumesError;
      }

      const { error: updateError } = await supabase
        .from("pending_collections")
        .update({
          status: "approved",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", suggestion.id);

      if (updateError) throw updateError;

      alert("Sugestão aprovada e adicionada ao catálogo global");
      loadData();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      alert("Erro ao aprovar sugestão: " + error.message);
    }
  };

  const handleRejectSuggestion = async (suggestion) => {
    try {
      const { error } = await supabase
        .from("pending_collections")
        .update({
          status: "rejected",
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", suggestion.id);

      if (error) throw error;

      alert("Sugestão rejeitada");
      loadData();
    } catch (error) {
      console.error("Erro ao rejeitar:", error);
      alert("Erro ao rejeitar sugestão");
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await supabase.from("user_volumes").delete().eq("user_id", userId);
      await supabase.from("user_collections").delete().eq("user_id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("pending_collections").delete().eq("created_by", userId);

      alert("Usuário removido com sucesso");
      loadData();
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      alert("Erro ao deletar usuário");
    }
  };

  const handleResetUserCollection = async (userId) => {
    try {
      await supabase.from("user_volumes").delete().eq("user_id", userId);
      await supabase.from("user_collections").delete().eq("user_id", userId);

      alert("Coleção do usuário resetada com sucesso");
      setSelectedUserForReset(null);
      loadData();
    } catch (error) {
      console.error("Erro ao resetar coleção:", error);
      alert("Erro ao resetar coleção");
    }
  };

  const handleDeleteCollection = async (collectionId) => {
    try {
      await supabase.from("volumes").delete().eq("collection_id", collectionId);
      await supabase.from("user_collections").delete().eq("collection_id", collectionId);
      await supabase.from("collections").delete().eq("id", collectionId);

      alert("Coleção removida com sucesso");
      loadData();
    } catch (error) {
      console.error("Erro ao deletar coleção:", error);
      alert("Erro ao deletar coleção");
    }
  };

  const handleViewUserCollection = async (userId) => {
    alert(`Visualizar coleção do usuário ${userId} - Funcionalidade em desenvolvimento`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400">
            Painel Administrativo
          </h1>
          <button
            onClick={() => navigate("/")}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
          >
            Voltar ao Início
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Usuários</p>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
              </div>
              <FaUsers className="text-blue-400 text-3xl" />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Coleções</p>
                <p className="text-2xl font-bold">{stats.totalCollections}</p>
              </div>
              <FaBook className="text-green-400 text-3xl" />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Volumes</p>
                <p className="text-2xl font-bold">{stats.totalVolumes}</p>
              </div>
              <FaLayerGroup className="text-yellow-400 text-3xl" />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Sugestões</p>
                <p className="text-2xl font-bold">{stats.pendingSuggestions}</p>
              </div>
              <FaPlusCircle className="text-purple-400 text-3xl" />
            </div>
          </div>
        </div>

        <div className="flex space-x-2 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === "suggestions"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Sugestões Pendentes
            {stats.pendingSuggestions > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {stats.pendingSuggestions}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "users"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Usuários
          </button>
          <button
            onClick={() => setActiveTab("collections")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "collections"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Coleções
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          
          {activeTab === "suggestions" && (
            <div>
              <h2 className="text-xl font-bold mb-4">Sugestões de Coleções</h2>
              {suggestions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  Nenhuma sugestão pendente
                </p>
              ) : (
                <div className="space-y-4">
                  {suggestions.map(suggestion => (
                    <div
                      key={suggestion.id}
                      className="bg-gray-700 rounded-lg p-4 flex items-start justify-between"
                    >
                      <div className="flex items-start space-x-4 flex-1">
                        {suggestion.cover_url && (
                          <img
                            src={suggestion.cover_url}
                            alt={suggestion.title}
                            className="w-16 h-20 object-cover rounded"
                            onError={(e) => {
                              e.target.src = "https://via.placeholder.com/64x80?text=Erro";
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {suggestion.title}
                          </h3>
                          <p className="text-sm text-gray-400">
                            Tipo: {suggestion.type === "single" ? "Volume Único" : "Série"}
                          </p>
                          {suggestion.cover_price && (
                            <p className="text-sm text-gray-400">
                              Preço: R$ {suggestion.cover_price}
                            </p>
                          )}
                          {suggestion.volumes_data && (
                            <p className="text-sm text-gray-400">
                              Volumes: {suggestion.volumes_data.length}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-2">
                            Sugerido por: {suggestion.userEmail || "Desconhecido"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Em: {new Date(suggestion.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveSuggestion(suggestion)}
                          className="bg-green-600 hover:bg-green-700 p-2 rounded-lg"
                          title="Aprovar"
                        >
                          <FaCheck />
                        </button>
                        <button
                          onClick={() => handleRejectSuggestion(suggestion)}
                          className="bg-red-600 hover:bg-red-700 p-2 rounded-lg"
                          title="Rejeitar"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <h2 className="text-xl font-bold mb-4">Gerenciar Usuários</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3">Email</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Coleções</th>
                      <th className="pb-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-gray-700">
                        <td className="py-3">{user.email}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            user.role === "admin" 
                              ? "bg-purple-600" 
                              : "bg-gray-600"
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3">{user.collectionsCount}</td>
                        <td className="py-3">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleViewUserCollection(user.id)}
                              className="text-blue-400 hover:text-blue-300"
                              title="Ver Coleção"
                            >
                              <FaEye />
                            </button>
                            <button
                              onClick={() => setSelectedUserForReset(user)}
                              className="text-yellow-400 hover:text-yellow-300"
                              title="Resetar Coleção"
                            >
                              <FaUndo />
                            </button>
                            {user.role !== "admin" && (
                              <button
                                onClick={() => {
                                  setSelectedItem(user);
                                  setConfirmAction("deleteUser");
                                  setShowConfirm(true);
                                }}
                                className="text-red-400 hover:text-red-300"
                                title="Deletar Usuário"
                              >
                                <FaTrash />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "collections" && (
            <div>
              <h2 className="text-xl font-bold mb-4">Gerenciar Coleções</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-3">Capa</th>
                      <th className="pb-3">Título</th>
                      <th className="pb-3">Tipo</th>
                      <th className="pb-3">Volumes</th>
                      <th className="pb-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map(collection => (
                      <tr key={collection.id} className="border-b border-gray-700">
                        <td className="py-3">
                          {collection.cover_url && (
                            <img
                              src={collection.cover_url}
                              alt={collection.title}
                              className="w-10 h-14 object-cover rounded"
                              onError={(e) => {
                                e.target.src = "https://via.placeholder.com/40x56?text=Erro";
                              }}
                            />
                          )}
                        </td>
                        <td className="py-3">{collection.title}</td>
                        <td className="py-3">
                          {collection.type === "single" ? "Único" : "Série"}
                        </td>
                        <td className="py-3">{collection.volumesCount}</td>
                        <td className="py-3">
                          <button
                            onClick={() => {
                              setSelectedItem(collection);
                              setConfirmAction("deleteCollection");
                              setShowConfirm(true);
                            }}
                            className="text-red-400 hover:text-red-300"
                            title="Deletar Coleção"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {selectedUserForReset && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-yellow-400">
                Resetar Coleção
              </h3>
              <p className="text-gray-300 mb-6">
                Tem certeza que deseja resetar a coleção de {selectedUserForReset.email}?
                Isso removerá todos os volumes marcados como adquiridos.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedUserForReset(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleResetUserCollection(selectedUserForReset.id)}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg"
                >
                  Confirmar Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700">
              <h3 className="text-xl font-bold mb-4 text-red-400">
                Confirmar Exclusão
              </h3>
              <p className="text-gray-300 mb-6">
                {confirmAction === "deleteUser" && "Tem certeza que deseja deletar este usuário? Esta ação removerá todas as suas coleções e dados."}
                {confirmAction === "deleteCollection" && "Tem certeza que deseja deletar esta coleção? Esta ação removerá a coleção de todos os usuários."}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (confirmAction === "deleteUser") {
                      await handleDeleteUser(selectedItem.id);
                    } else if (confirmAction === "deleteCollection") {
                      await handleDeleteCollection(selectedItem.id);
                    }
                    setShowConfirm(false);
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}