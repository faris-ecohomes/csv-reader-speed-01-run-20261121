// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01-run-20261121).
//
// Returns exactly what csv-reader 1.0.0 returns for {text, header}:
// {columns, rows, errors}. Same broken-row policy as the reference:
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (error stray_cr);
//   - a field opening with a quote runs to the next non-doubled quote ("" is one
//     quote), CRLF or lone CR inside it reads as LF; text after the closing quote
//     up to the next comma or line break is appended as it stands (quote_junk);
//     a quote that never closes is a literal character and the text after it is
//     read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay strings;
//   - columns is the first record when header is true, else null; rows are the
//     records after it, each padded (short_row) or cut (long_row) to the first
//     record's width; each error is {code, line, row} in the order met.
//
// Speed comes from scanning in bulk: one regex exec finds the next delimiter
// instead of walking one character at a time, and fields are taken with slice()
// instead of being built up a character at a time.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

// Next comma, LF or CR.
const DELIM = /[,\r\n]/g;
// Next quote, LF or CR (inside a quoted field).
const QDELIM = /["\r\n]/g;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // The record being read: the line it starts on and its index in rows (null: header).
  let recordLine = 1;
  let recordRow = null;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `value` up to the next comma or line break.
  // A CR not followed by LF is dropped (stray_cr). Returns the field, how it
  // ended, and how many characters were kept during this call.
  function readUnquoted(value) {
    const startLen = value.length;
    while (pos < len) {
      DELIM.lastIndex = pos;
      const m = DELIM.exec(text);
      if (m === null) {
        value += text.slice(pos);
        pos = len;
        break;
      }
      const idx = m.index;
      const ch = text[idx];
      if (ch === ',') {
        value += text.slice(pos, idx);
        pos = idx + 1;
        return { value, ended: COMMA, added: value.length - startLen };
      }
      if (ch === '\n') {
        value += text.slice(pos, idx);
        pos = idx + 1;
        line += 1;
        return { value, ended: LINE_BREAK, added: value.length - startLen };
      }
      // ch === '\r'
      if (text[idx + 1] === '\n') {
        value += text.slice(pos, idx);
        pos = idx + 2;
        line += 1;
        return { value, ended: LINE_BREAK, added: value.length - startLen };
      }
      error('stray_cr');
      value += text.slice(pos, idx);
      pos = idx + 1;
    }
    return { value, ended: END, added: value.length - startLen };
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let closed = false;
    while (pos < len) {
      QDELIM.lastIndex = pos;
      const m = QDELIM.exec(text);
      if (m === null) break;
      const idx = m.index;
      const ch = text[idx];
      if (ch === '"') {
        if (text[idx + 1] === '"') {
          value += text.slice(pos, idx) + '"';
          pos = idx + 2;
          continue;
        }
        value += text.slice(pos, idx);
        pos = idx + 1;
        closed = true;
        break;
      }
      if (ch === '\r') {
        // CRLF and a lone CR inside quotes are each one LF.
        value += text.slice(pos, idx) + '\n';
        line += 1;
        pos = text[idx + 1] === '\n' ? idx + 2 : idx + 1;
        continue;
      }
      // ch === '\n'
      value += text.slice(pos, idx) + '\n';
      line += 1;
      pos = idx + 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after
      // it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      return readUnquoted('"');
    }
    if (pos >= len) return { value, ended: END };
    const c = text[pos];
    if (c === ',') {
      pos += 1;
      return { value, ended: COMMA };
    }
    if (c === '\n') {
      pos += 1;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    if (c === '\r' && text[pos + 1] === '\n') {
      pos += 2;
      line += 1;
      return { value, ended: LINE_BREAK };
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    const junk = readUnquoted(value);
    if (junk.added > 0) error('quote_junk');
    return junk;
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      if (text[pos] === '\n') {
        pos += 1;
        line += 1;
      } else if (text[pos] === '\r' && text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let quoted;
    do {
      quoted = text[pos] === '"';
      field = quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
