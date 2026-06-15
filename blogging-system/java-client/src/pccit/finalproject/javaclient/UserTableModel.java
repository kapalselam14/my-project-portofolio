package pccit.finalproject.javaclient;

import javax.swing.table.AbstractTableModel;
import java.util.ArrayList;
import java.util.List;

public class UserTableModel extends AbstractTableModel {
    private final String[] columns = {"Username", "Real Name"};
    private final List<User> users = new ArrayList<>();

    public void setUsers(List<User> newUsers) {
        users.clear();
        if (newUsers != null) users.addAll(newUsers);
        fireTableDataChanged();
    }

    public void removeUser(int row) {
        if (row >= 0 && row < users.size()) {
            users.remove(row);
            fireTableRowsDeleted(row, row);
        }
    }

    public User getUserAt(int row) {
        if (row >= 0 && row < users.size()) return users.get(row);
        return null;
    }

    @Override
    public int getRowCount() { return users.size(); }

    @Override
    public int getColumnCount() { return columns.length; }

    @Override
    public String getColumnName(int column) { return columns[column]; }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        User u = users.get(rowIndex);
        switch (columnIndex) {
            case 0: return u.getUsername();
            case 1: return u.getRealName(); // Show real name instead of display name
            default: return "";
        }
    }
}
