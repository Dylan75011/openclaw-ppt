const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.resolve('./data');
const DB_FILE = path.join(DATA_DIR, 'platform.sqlite');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

ensureDataDir();

const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    state_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_message_at TEXT
  );

  CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_workspace_updated
    ON conversations(workspace_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_messages_conversation_sort
    ON conversation_messages(conversation_id, sort_order ASC);
`);

const stmts = {
  listConversations: db.prepare(`
    SELECT
      c.id,
      c.workspace_id AS workspaceId,
      c.title,
      c.status,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      c.last_message_at AS lastMessageAt,
      COUNT(m.id) AS messageCount
    FROM conversations c
    LEFT JOIN conversation_messages m ON m.conversation_id = c.id
    WHERE c.workspace_id = ?
    GROUP BY c.id
    ORDER BY c.updated_at DESC
  `),
  getConversation: db.prepare(`
    SELECT
      id,
      workspace_id AS workspaceId,
      title,
      status,
      state_json AS stateJson,
      created_at AS createdAt,
      updated_at AS updatedAt,
      last_message_at AS lastMessageAt
    FROM conversations
    WHERE id = ?
  `),
  getMessages: db.prepare(`
    SELECT
      id,
      payload_json AS payloadJson,
      created_at AS createdAt
    FROM conversation_messages
    WHERE conversation_id = ?
    ORDER BY sort_order ASC
  `),
  insertConversation: db.prepare(`
    INSERT INTO conversations (
      id, workspace_id, title, status, state_json, created_at, updated_at, last_message_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateConversation: db.prepare(`
    UPDATE conversations
    SET title = ?, status = ?, state_json = ?, updated_at = ?, last_message_at = ?
    WHERE id = ?
  `),
  deleteConversationMessages: db.prepare(`
    DELETE FROM conversation_messages WHERE conversation_id = ?
  `),
  insertMessage: db.prepare(`
    INSERT INTO conversation_messages (
      id, conversation_id, sort_order, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?)
  `),
  deleteConversation: db.prepare(`
    DELETE FROM conversations WHERE id = ?
  `),
  deleteByWorkspace: db.prepare(`
    DELETE FROM conversations WHERE workspace_id = ?
  `),
  upsertMessage: db.prepare(`
    INSERT INTO conversation_messages (id, conversation_id, sort_order, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sort_order = excluded.sort_order,
      payload_json = excluded.payload_json
  `),
  getMaxSortOrder: db.prepare(`
    SELECT COALESCE(MAX(sort_order), -1) AS maxOrder
    FROM conversation_messages WHERE conversation_id = ?
  `),
  touchConversation: db.prepare(`
    UPDATE conversations
    SET updated_at = ?, last_message_at = ?, state_json = COALESCE(?, state_json), title = COALESCE(?, title), status = COALESCE(?, status)
    WHERE id = ?
  `)
};

function saveConversationTxn(conversationId, payload) {
  const conversation = stmts.getConversation.get(conversationId);
  if (!conversation) throw new Error(`会话不存在: ${conversationId}`);

  const now = new Date().toISOString();
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const lastMessageAt = payload.lastMessageAt || messages.at(-1)?.createdAt || conversation.lastMessageAt || now;
  db.exec('BEGIN');
  try {
    stmts.updateConversation.run(
      payload.title || conversation.title,
      payload.status || conversation.status || 'active',
      JSON.stringify(payload.state || {}),
      now,
      lastMessageAt,
      conversationId
    );

    stmts.deleteConversationMessages.run(conversationId);
    messages.forEach((message, index) => {
      stmts.insertMessage.run(
        message.id || `msg_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
        conversationId,
        index,
        JSON.stringify(message),
        message.createdAt || now
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function createConversation(workspaceId, title = '新对话') {
  const now = new Date().toISOString();
  const id = `conv_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  stmts.insertConversation.run(id, workspaceId, title, 'active', '{}', now, now, null);
  return getConversation(id);
}

function listConversations(workspaceId) {
  return stmts.listConversations.all(workspaceId);
}

function getConversation(id) {
  const conversation = stmts.getConversation.get(id);
  if (!conversation) return null;
  return {
    ...conversation,
    state: safeJson(conversation.stateJson, {})
  };
}

function getConversationDetail(id) {
  const conversation = getConversation(id);
  if (!conversation) return null;
  const messages = stmts.getMessages.all(id).map(row => ({
    ...safeJson(row.payloadJson, {}),
    id: row.id,
    createdAt: row.createdAt
  }));
  return {
    ...conversation,
    messages
  };
}

function saveConversationSnapshot(id, payload = {}) {
  saveConversationTxn(id, payload);
  return getConversationDetail(id);
}

/**
 * Incrementally upsert a single message (no DELETE). Safe under interleaved
 * writes — used during SSE streaming so partial assistant text is persisted
 * frequently without risking stale full-snapshot overwrites.
 */
function appendMessage(conversationId, message, { state, title, status } = {}) {
  const conversation = stmts.getConversation.get(conversationId);
  if (!conversation) throw new Error(`会话不存在: ${conversationId}`);
  if (!message || !message.id) throw new Error('appendMessage: message.id 必填');

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    // If the message is new, assign it sort_order = max+1; if it already exists,
    // keep its existing sort_order by reading it back first.
    const existing = db.prepare(
      'SELECT sort_order AS sortOrder FROM conversation_messages WHERE id = ? AND conversation_id = ?'
    ).get(message.id, conversationId);
    let sortOrder;
    if (existing) {
      sortOrder = existing.sortOrder;
    } else {
      const row = stmts.getMaxSortOrder.get(conversationId);
      sortOrder = (row?.maxOrder ?? -1) + 1;
    }
    stmts.upsertMessage.run(
      message.id,
      conversationId,
      sortOrder,
      JSON.stringify(message),
      message.createdAt || now
    );
    stmts.touchConversation.run(
      now,
      message.createdAt || now,
      state !== undefined ? JSON.stringify(state) : null,
      title || null,
      status || null,
      conversationId
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function deleteConversation(id) {
  stmts.deleteConversation.run(id);
}

function deleteWorkspaceConversations(workspaceId) {
  stmts.deleteByWorkspace.run(workspaceId);
}

function safeJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

module.exports = {
  createConversation,
  listConversations,
  getConversation,
  getConversationDetail,
  saveConversationSnapshot,
  appendMessage,
  deleteConversation,
  deleteWorkspaceConversations
};
