// Função auxiliar para buscar base legal de uma determinação
export const getBaseLegalForDeterminacao = (determinacao, itemsChecklist) => {
    // Tenta encontrar um item do checklist que corresponda à determinação
    const itemChecklist = itemsChecklist.find(i => 
        i.artigo_portaria && i.texto_determinacao && 
        determinacao.descricao.toLowerCase().includes(i.texto_determinacao.toLowerCase().substring(0, 50))
    );
    
    if (itemChecklist?.artigo_portaria) {
        return itemChecklist.artigo_portaria;
    }
    
    return 'Portaria AGEMS nº 233/2022 e suas alterações';
};